import { CfnVPCEndpoint, Connections, GatewayVpcEndpointOptions, IConnectable, IGatewayVpcEndpoint, InterfaceVpcEndpointAttributes, InterfaceVpcEndpointAwsService, InterfaceVpcEndpointOptions, IVpcEndpoint, Peer, Port, VpcEndpoint, VpcEndpointType } from 'aws-cdk-lib/aws-ec2';
import { IVpcV2 } from './vpc-v2-base';
import { propertyInjectable } from 'aws-cdk-lib/core/lib/prop-injectable';
import * as cxschema from 'aws-cdk-lib/cloud-assembly-schema';
import { Construct } from 'constructs';
import { addConstructMetadata } from 'aws-cdk-lib/core/lib/metadata-resource';
import { ISubnetV2 } from './subnet-v2';
import { allRouteTableIds, flatten } from './util';
import { ContextProvider, Lazy, Resource, Stack, Token, ValidationError } from 'aws-cdk-lib';
import { SecurityGroup } from './security-group';

/**
 * Construction properties for a GatewayVpcEndpoint.
 */
export interface GatewayVpcEndpointProps extends GatewayVpcEndpointOptions {
  /**
   * The VPC network in which the gateway endpoint will be used.
   */
  readonly vpc: IVpcV2;
}

/**
 * A gateway VPC endpoint.
 * @resource AWS::EC2::VPCEndpoint
 */
@propertyInjectable
export class GatewayVpcEndpoint extends VpcEndpoint implements IGatewayVpcEndpoint {
  /** Uniquely identifies this class. */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-ec2.GatewayVpcEndpoint';

  public static fromGatewayVpcEndpointId(scope: Construct, id: string, gatewayVpcEndpointId: string): IGatewayVpcEndpoint {
    class Import extends VpcEndpoint {
      public vpcEndpointId = gatewayVpcEndpointId;
    }

    return new Import(scope, id);
  }

  /**
   * The gateway VPC endpoint identifier.
   */
  public readonly vpcEndpointId: string;

  /**
   * The date and time the gateway VPC endpoint was created.
   * @attribute
   */
  public readonly vpcEndpointCreationTimestamp: string;

  /**
   * @attribute
   */
  public readonly vpcEndpointNetworkInterfaceIds: string[];

  /**
   * @attribute
   */
  public readonly vpcEndpointDnsEntries: string[];

  constructor(scope: Construct, id: string, props: GatewayVpcEndpointProps) {
    super(scope, id);
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    const subnets: ISubnetV2[] = props.subnets
      ? flatten(props.subnets.map(s => props.vpc.selectSubnets(s).subnets))
      : [...props.vpc.privateSubnets, ...props.vpc.publicSubnets, ...props.vpc.isolatedSubnets];
    const routeTableIds = allRouteTableIds(subnets);

    if (routeTableIds.length === 0) {
      throw new ValidationError('Can\'t add a gateway endpoint to VPC; route table IDs are not available', this);
    }

    const endpoint = new CfnVPCEndpoint(this, 'Resource', {
      policyDocument: Lazy.any({ produce: () => this.policyDocument }),
      routeTableIds,
      serviceName: props.service.name,
      vpcEndpointType: VpcEndpointType.GATEWAY,
      vpcId: props.vpc.vpcId,
    });

    this.vpcEndpointId = endpoint.ref;
    this.vpcEndpointCreationTimestamp = endpoint.attrCreationTimestamp;
    this.vpcEndpointDnsEntries = endpoint.attrDnsEntries;
    this.vpcEndpointNetworkInterfaceIds = endpoint.attrNetworkInterfaceIds;
  }
}

/**
 * Construction properties for an InterfaceVpcEndpoint.
 */
export interface InterfaceVpcEndpointProps extends InterfaceVpcEndpointOptions {
  /**
   * The VPC network in which the interface endpoint will be used.
   */
  readonly vpc: IVpcV2;
}

/**
 * An interface VPC endpoint.
 */
export interface IInterfaceVpcEndpoint extends IVpcEndpoint, IConnectable {
}

/**
 * A interface VPC endpoint.
 * @resource AWS::EC2::VPCEndpoint
 */
@propertyInjectable
export class InterfaceVpcEndpoint extends VpcEndpoint implements IInterfaceVpcEndpoint {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-ec2.InterfaceVpcEndpoint';

  /**
   * Imports an existing interface VPC endpoint.
   */
  public static fromInterfaceVpcEndpointAttributes(scope: Construct, id: string, attrs: InterfaceVpcEndpointAttributes): IInterfaceVpcEndpoint {
    class Import extends Resource implements IInterfaceVpcEndpoint {
      public readonly vpcEndpointId = attrs.vpcEndpointId;
      public readonly connections = new Connections({
        defaultPort: Port.tcp(attrs.port),
        securityGroups: attrs.securityGroups,
      });
    }

    return new Import(scope, id);
  }

  /**
   * The interface VPC endpoint identifier.
   */
  public readonly vpcEndpointId: string;

  /**
   * The date and time the interface VPC endpoint was created.
   * @attribute
   */
  public readonly vpcEndpointCreationTimestamp: string;

  /**
   * The DNS entries for the interface VPC endpoint.
   * Each entry is a combination of the hosted zone ID and the DNS name.
   * The entries are ordered as follows: regional public DNS, zonal public DNS, private DNS, and wildcard DNS.
   * This order is not enforced for AWS Marketplace services.
   *
   * The following is an example. In the first entry, the hosted zone ID is Z1HUB23UULQXV
   * and the DNS name is vpce-01abc23456de78f9g-12abccd3.ec2.us-east-1.vpce.amazonaws.com.
   *
   * ["Z1HUB23UULQXV:vpce-01abc23456de78f9g-12abccd3.ec2.us-east-1.vpce.amazonaws.com",
   * "Z1HUB23UULQXV:vpce-01abc23456de78f9g-12abccd3-us-east-1a.ec2.us-east-1.vpce.amazonaws.com",
   * "Z1C12344VYDITB0:ec2.us-east-1.amazonaws.com"]
   *
   * If you update the PrivateDnsEnabled or SubnetIds properties, the DNS entries in the list will change.
   * @attribute
   */
  public readonly vpcEndpointDnsEntries: string[];

  /**
   * One or more network interfaces for the interface VPC endpoint.
   * @attribute
   */
  public readonly vpcEndpointNetworkInterfaceIds: string[];

  /**
   * The identifier of the first security group associated with this interface
   * VPC endpoint.
   *
   * @deprecated use the `connections` object
   */
  public readonly securityGroupId: string;

  /**
   * Access to network connections.
   */
  public readonly connections: Connections;

  constructor(scope: Construct, id: string, props: InterfaceVpcEndpointProps) {
    super(scope, id);
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    const securityGroups = props.securityGroups || [new SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
    })];

    this.securityGroupId = securityGroups[0].securityGroupId;
    this.connections = new Connections({
      defaultPort: Port.tcp(props.service.port),
      securityGroups,
    });

    if (props.open !== false) {
      if (props.vpc.ipv4CidrBlock) {
        this.connections.allowDefaultPortFrom(Peer.ipv4(props.vpc.ipv4CidrBlock));
      }
    }

    // Determine which subnets to place the endpoint in
    const subnetIds = this.endpointSubnets(props);

    const dnsOptions = (props.dnsRecordIpType === undefined && props.privateDnsOnlyForInboundResolverEndpoint === undefined)
      ? undefined
      : {
        dnsRecordIpType: props.dnsRecordIpType,
        privateDnsOnlyForInboundResolverEndpoint: props.privateDnsOnlyForInboundResolverEndpoint,
      };

    const endpoint = new CfnVPCEndpoint(this, 'Resource', {
      privateDnsEnabled: props.privateDnsEnabled ?? props.service.privateDnsDefault ?? true,
      policyDocument: Lazy.any({ produce: () => this.policyDocument }),
      securityGroupIds: securityGroups.map(s => s.securityGroupId),
      serviceName: props.service.name,
      vpcEndpointType: VpcEndpointType.INTERFACE,
      subnetIds,
      vpcId: props.vpc.vpcId,
      ipAddressType: props.ipAddressType,
      dnsOptions,
    });

    this.vpcEndpointId = endpoint.ref;
    this.vpcEndpointCreationTimestamp = endpoint.attrCreationTimestamp;
    this.vpcEndpointDnsEntries = endpoint.attrDnsEntries;
    this.vpcEndpointNetworkInterfaceIds = endpoint.attrNetworkInterfaceIds;
  }

  /**
   * Determine which subnets to place the endpoint in. This is in its own function
   * because there's a lot of code.
   */
  private endpointSubnets(props: InterfaceVpcEndpointProps) {
    const lookupSupportedAzs = props.lookupSupportedAzs ?? false;
    const subnetSelection = props.vpc.selectSubnets({ ...props.subnets, onePerAz: true });
    const subnets = subnetSelection.subnets;

    // Sanity check the subnet count
    if (!subnetSelection.isPendingLookup && subnetSelection.subnets.length == 0) {
      throw new ValidationError('Cannot create a VPC Endpoint with no subnets', this);
    }

    // If we aren't going to lookup supported AZs we'll exit early, returning the subnetIds from the provided subnet selection
    if (!lookupSupportedAzs) {
      return subnetSelection.subnetIds;
    }

    // Some service names, such as AWS service name references, use Tokens to automatically fill in the region
    // If it is an InterfaceVpcEndpointAwsService, then the reference will be resolvable since it only references the region
    const isAwsService = Token.isUnresolved(props.service.name) && props.service instanceof InterfaceVpcEndpointAwsService;

    // Determine what service name gets pass to the context provider
    // If it is an AWS service it will have a REGION token
    const lookupServiceName = isAwsService ? Stack.of(this).resolve(props.service.name) : props.service.name;

    // Check that the lookup will work
    this.validateCanLookupSupportedAzs(subnets, lookupServiceName);

    // Do the actual lookup for AZs
    const availableAZs = this.availableAvailabilityZones(lookupServiceName);
    const filteredSubnets = subnets.filter(s => availableAZs.includes(s.availabilityZone));

    // Throw an error if the lookup filtered out all subnets
    // VpcEndpoints must be created with at least one AZ
    if (filteredSubnets.length == 0) {
      throw new ValidationError(`lookupSupportedAzs returned ${availableAZs} but subnets have AZs ${subnets.map(s => s.availabilityZone)}`, this);
    }
    return filteredSubnets.map(s => s.subnetId);
  }

  /**
   * Sanity checking when looking up AZs for an endpoint service, to make sure it won't fail
   */
  private validateCanLookupSupportedAzs(subnets: ISubnetV2[], serviceName: string) {
    // Having any of these be true will cause the AZ lookup to fail at synthesis time
    const agnosticAcct = Token.isUnresolved(this.env.account);
    const agnosticRegion = Token.isUnresolved(this.env.region);
    const agnosticService = Token.isUnresolved(serviceName);

    // Having subnets with Token AZs can cause the endpoint to be created with no subnets, failing at deployment time
    const agnosticSubnets = subnets.some(s => Token.isUnresolved(s.availabilityZone));
    const agnosticSubnetList = Token.isUnresolved(subnets.map(s => s.availabilityZone));

    // Context provider cannot make an AWS call without an account/region
    if (agnosticAcct || agnosticRegion) {
      throw new ValidationError('Cannot look up VPC endpoint availability zones if account/region are not specified', this);
    }

    // The AWS call will fail if there is a Token in the service name
    if (agnosticService) {
      throw new ValidationError(`Cannot lookup AZs for a service name with a Token: ${serviceName}`, this);
    }

    // The AWS call return strings for AZs, like us-east-1a, us-east-1b, etc
    // If the subnet AZs are Tokens, a string comparison between the subnet AZs and the AZs from the AWS call
    // will not match
    if (agnosticSubnets || agnosticSubnetList) {
      const agnostic = subnets.filter(s => Token.isUnresolved(s.availabilityZone));
      throw new ValidationError(`lookupSupportedAzs cannot filter on subnets with Token AZs: ${agnostic}`, this);
    }
  }

  private availableAvailabilityZones(serviceName: string): string[] {
    // Here we check what AZs the endpoint service is available in
    // If for whatever reason we can't retrieve the AZs, and no context is set,
    // we will fall back to all AZs
    const availableAZs = ContextProvider.getValue(this, {
      provider: cxschema.ContextProvider.ENDPOINT_SERVICE_AVAILABILITY_ZONE_PROVIDER,
      dummyValue: this.stack.availabilityZones,
      props: { serviceName },
    }).value;
    if (!Array.isArray(availableAZs)) {
      throw new ValidationError(`Discovered AZs for endpoint service ${serviceName} must be an array`, this);
    }
    return availableAZs;
  }
}
