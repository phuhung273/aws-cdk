import { booleanToEnabledDisabled, CfnClientVpnEndpoint, CfnClientVpnTargetNetworkAssociation, ClientVpnAuthorizationRule, ClientVpnAuthorizationRuleOptions, ClientVpnEndpointAttributes, ClientVpnEndpointOptions, ClientVpnRoute, ClientVpnRouteOptions, Connections, IClientVpnEndpoint, renderAuthenticationOptions } from "aws-cdk-lib/aws-ec2";
import { IVpcV2 } from "./vpc-v2-base";
import { propertyInjectable } from "aws-cdk-lib/core/lib/prop-injectable";
import { Resource, Token, ValidationError, CfnOutput } from "aws-cdk-lib";
import { addConstructMetadata, MethodMetadata } from "aws-cdk-lib/core/lib/metadata-resource";
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct, IDependable, DependencyGroup } from "constructs";
import { CidrBlock } from "./util";
import { SecurityGroup } from "./security-group";

/**
 * Properties for a client VPN endpoint
 */
export interface ClientVpnEndpointProps extends ClientVpnEndpointOptions {
  /**
   * The VPC to connect to.
   */
  readonly vpc: IVpcV2;
}

/**
 * A client VPN connection
 */
@propertyInjectable
export class ClientVpnEndpoint extends Resource implements IClientVpnEndpoint {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-ec2.ClientVpnEndpoint';

  /**
   * Import an existing client VPN endpoint
   */
  public static fromEndpointAttributes(scope: Construct, id: string, attrs: ClientVpnEndpointAttributes): IClientVpnEndpoint {
    class Import extends Resource implements IClientVpnEndpoint {
      public readonly endpointId = attrs.endpointId;
      public readonly connections = new Connections({ securityGroups: attrs.securityGroups });
      public readonly targetNetworksAssociated: IDependable = new DependencyGroup();
    }
    return new Import(scope, id);
  }

  public readonly endpointId: string;

  /**
   * Allows specify security group connections for the endpoint.
   */
  public readonly connections: Connections;

  public readonly targetNetworksAssociated: IDependable;

  private readonly _targetNetworksAssociated = new DependencyGroup();

  constructor(scope: Construct, id: string, props: ClientVpnEndpointProps) {
    super(scope, id);
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    if (props.vpc.ipv4CidrBlock && !Token.isUnresolved(props.vpc.ipv4CidrBlock)) {
      const clientCidr = new CidrBlock(props.cidr);
      const vpcCidr = new CidrBlock(props.vpc.ipv4CidrBlock);
      if (vpcCidr.containsCidr(clientCidr)) {
        throw new ValidationError('The client CIDR cannot overlap with the local CIDR of the VPC', this);
      }
    }

    if (props.dnsServers && props.dnsServers.length > 2) {
      throw new ValidationError('A client VPN endpoint can have up to two DNS servers', this);
    }

    if (props.logging == false && (props.logGroup || props.logStream)) {
      throw new ValidationError('Cannot specify `logGroup` or `logStream` when logging is disabled', this);
    }

    if (props.clientConnectionHandler
      && !Token.isUnresolved(props.clientConnectionHandler.functionName)
      && !props.clientConnectionHandler.functionName.startsWith('AWSClientVPN-')) {
      throw new ValidationError('The name of the Lambda function must begin with the `AWSClientVPN-` prefix', this);
    }

    if (props.clientLoginBanner
      && !Token.isUnresolved(props.clientLoginBanner)
      && props.clientLoginBanner.length > 1400) {
      throw new ValidationError(`The maximum length for the client login banner is 1400, got ${props.clientLoginBanner.length}`, this);
    }

    const logging = props.logging ?? true;
    const logGroup = logging
      ? props.logGroup ?? new logs.LogGroup(this, 'LogGroup')
      : undefined;

    const securityGroups = props.securityGroups ?? [new SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
    })];
    this.connections = new Connections({ securityGroups });

    const endpoint = new CfnClientVpnEndpoint(this, 'Resource', {
      authenticationOptions: renderAuthenticationOptions(props.clientCertificateArn, props.userBasedAuthentication),
      clientCidrBlock: props.cidr,
      clientConnectOptions: props.clientConnectionHandler
        ? {
          enabled: true,
          lambdaFunctionArn: props.clientConnectionHandler.functionArn,
        }
        : undefined,
      connectionLogOptions: {
        enabled: logging,
        cloudwatchLogGroup: logGroup?.logGroupName,
        cloudwatchLogStream: props.logStream?.logStreamName,
      },
      description: props.description,
      dnsServers: props.dnsServers,
      securityGroupIds: securityGroups.map(s => s.securityGroupId),
      selfServicePortal: booleanToEnabledDisabled(props.selfServicePortal),
      serverCertificateArn: props.serverCertificateArn,
      splitTunnel: props.splitTunnel,
      transportProtocol: props.transportProtocol,
      vpcId: props.vpc.vpcId,
      vpnPort: props.port,
      sessionTimeoutHours: props.sessionTimeout,
      clientLoginBannerOptions: props.clientLoginBanner
        ? {
          enabled: true,
          bannerText: props.clientLoginBanner,
        }
        : undefined,
    });

    this.endpointId = endpoint.ref;

    if (props.userBasedAuthentication && (props.selfServicePortal ?? true)) {
      // Output self-service portal URL
      new CfnOutput(this, 'SelfServicePortalUrl', {
        value: `https://self-service.clientvpn.amazonaws.com/endpoints/${this.endpointId}`,
      });
    }

    // Associate subnets
    const subnetIds = props.vpc.selectSubnets(props.vpcSubnets).subnetIds;

    if (Token.isUnresolved(subnetIds)) {
      throw new ValidationError('Cannot associate subnets when VPC are imported from parameters or exports containing lists of subnet IDs.', this);
    }

    for (const [idx, subnetId] of Object.entries(subnetIds)) {
      this._targetNetworksAssociated.add(new CfnClientVpnTargetNetworkAssociation(this, `Association${idx}`, {
        clientVpnEndpointId: this.endpointId,
        subnetId,
      }));
    }
    this.targetNetworksAssociated = this._targetNetworksAssociated;

    if (props.authorizeAllUsersToVpcCidr ?? true) {
      if (props.vpc.ipv4CidrBlock) {
        this.addAuthorizationRule('AuthorizeAll', {
          cidr: props.vpc.ipv4CidrBlock,
        });
      }
    }
  }

  /**
   * Adds an authorization rule to this endpoint
   */
  @MethodMetadata()
  public addAuthorizationRule(id: string, props: ClientVpnAuthorizationRuleOptions): ClientVpnAuthorizationRule {
    return new ClientVpnAuthorizationRule(this, id, {
      ...props,
      clientVpnEndpoint: this,
    });
  }

  /**
   * Adds a route to this endpoint
   */
  @MethodMetadata()
  public addRoute(id: string, props: ClientVpnRouteOptions): ClientVpnRoute {
    return new ClientVpnRoute(this, id, {
      ...props,
      clientVpnEndpoint: this,
    });
  }
}