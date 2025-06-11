import { CfnSubnetNetworkAclAssociation, INetworkAcl, ISubnetNetworkAclAssociation } from "aws-cdk-lib/aws-ec2";
import { ISubnetV2 } from "./subnet-v2";
import { propertyInjectable } from "aws-cdk-lib/core/lib/prop-injectable";
import { Resource } from "aws-cdk-lib";
import { Construct } from "constructs";
import { addConstructMetadata } from "aws-cdk-lib/core/lib/metadata-resource";

/**
 * Properties to create a SubnetNetworkAclAssociation
 *
 *
 */
export interface SubnetNetworkAclAssociationProps {
  /**
   * The name of the SubnetNetworkAclAssociation.
   *
   * It is not recommended to use an explicit name.
   *
   * @default If you don't specify a SubnetNetworkAclAssociationName, AWS CloudFormation generates a
   * unique physical ID and uses that ID for the group name.
   */
  readonly subnetNetworkAclAssociationName?: string;

  /**
   * The Network ACL this association is defined for
   *
   * @attribute
   */
  readonly networkAcl: INetworkAcl;

  /**
   * ID of the Subnet
   * @attribute
   */
  readonly subnet: ISubnetV2;
}

/**
 * Associate a network ACL with a subnet
 *
 *
 */
abstract class SubnetNetworkAclAssociationBase extends Resource implements ISubnetNetworkAclAssociation {
  public abstract readonly subnetNetworkAclAssociationAssociationId: string;
}

@propertyInjectable
export class SubnetNetworkAclAssociation extends SubnetNetworkAclAssociationBase {
  /** Uniquely identifies this class. */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-ec2.SubnetNetworkAclAssociation';

  public static fromSubnetNetworkAclAssociationAssociationId(
    scope: Construct, id: string,
    subnetNetworkAclAssociationAssociationId: string): ISubnetNetworkAclAssociation {
    class Import extends SubnetNetworkAclAssociationBase {
      public readonly subnetNetworkAclAssociationAssociationId = subnetNetworkAclAssociationAssociationId;
    }

    return new Import(scope, id);
  }
  /**
   * ID for the current SubnetNetworkAclAssociation
   * @attribute
   */
  public readonly subnetNetworkAclAssociationAssociationId: string;

  /**
   * ID for the current Network ACL
   * @attribute
   */
  public readonly networkAcl: INetworkAcl;

  /**
   * ID of the Subnet
   * @attribute
   */
  public readonly subnet: ISubnetV2;

  private association: CfnSubnetNetworkAclAssociation;

  constructor(scope: Construct, id: string, props: SubnetNetworkAclAssociationProps) {
    super(scope, id, {
      physicalName: props.subnetNetworkAclAssociationName,
    });
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata (this, props);

    this.association = new CfnSubnetNetworkAclAssociation(this, 'Resource', {
      networkAclId: props.networkAcl.networkAclId,
      subnetId: props.subnet.subnetId,
    });

    this.networkAcl = props.networkAcl;
    this.subnet = props.subnet;
    this.subnetNetworkAclAssociationAssociationId = this.association.attrAssociationId;
  }
}
