import { Construct } from 'constructs';
import { ContainerDefinition, Ec2Service, Ec2TaskDefinition, PlacementConstraint, PlacementStrategy } from '../../../aws-ecs';
import { FeatureFlags } from '../../../core';
import * as cxapi from '../../../cx-api';
import {
  ApplicationMultipleTargetGroupsServiceBase,
  ApplicationMultipleTargetGroupsServiceBaseProps,
} from '../base/application-multiple-target-groups-service-base';

/**
 * The properties for the ApplicationMultipleTargetGroupsEc2Service service.
 */
export interface ApplicationMultipleTargetGroupsEc2ServiceProps extends ApplicationMultipleTargetGroupsServiceBaseProps {

  /**
   * The task definition to use for tasks in the service. Only one of TaskDefinition or TaskImageOptions must be specified.
   *
   * [disable-awslint:ref-via-interface]
   *
   * @default - none
   */
  readonly taskDefinition?: Ec2TaskDefinition;

  /**
   * The minimum number of CPU units to reserve for the container.
   *
   * Valid values, which determines your range of valid values for the memory parameter:
   *
   * @default - No minimum CPU units reserved.
   */
  readonly cpu?: number;

  /**
   * The amount (in MiB) of memory to present to the container.
   *
   * If your container attempts to exceed the allocated memory, the container
   * is terminated.
   *
   * At least one of memoryLimitMiB and memoryReservationMiB is required.
   *
   * @default - No memory limit.
   */
  readonly memoryLimitMiB?: number;

  /**
   * The soft limit (in MiB) of memory to reserve for the container.
   *
   * When system memory is under heavy contention, Docker attempts to keep the
   * container memory to this soft limit. However, your container can consume more
   * memory when it needs to, up to either the hard limit specified with the memory
   * parameter (if applicable), or all of the available memory on the container
   * instance, whichever comes first.
   *
   * At least one of memoryLimitMiB and memoryReservationMiB is required.
   *
   * Note that this setting will be ignored if TaskImagesOptions is specified
   *
   * @default - No memory reserved.
   */
  readonly memoryReservationMiB?: number;

  /**
   * The placement constraints to use for tasks in the service. For more information, see
   * [Amazon ECS Task Placement Constraints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-constraints.html).
   *
   * @default - No constraints.
   */
  readonly placementConstraints?: PlacementConstraint[];

  /**
   * The placement strategies to use for tasks in the service. For more information, see
   * [Amazon ECS Task Placement Strategies](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-placement-strategies.html).
   *
   * @default - No strategies.
   */
  readonly placementStrategies?: PlacementStrategy[];
}

/**
 * An EC2 service running on an ECS cluster fronted by an application load balancer.
 */
export class ApplicationMultipleTargetGroupsEc2Service extends ApplicationMultipleTargetGroupsServiceBase {
  /**
   * The EC2 service in this construct.
   */
  public readonly service: Ec2Service;
  /**
   * The EC2 Task Definition in this construct.
   */
  public readonly taskDefinition: Ec2TaskDefinition;

  /**
   * Constructs a new instance of the ApplicationMultipleTargetGroupsEc2Service class.
   */
  constructor(scope: Construct, id: string, props: ApplicationMultipleTargetGroupsEc2ServiceProps = {}) {
    super(scope, id, props);

    if (props.taskDefinition && props.taskImageOptions) {
      throw new Error('You must specify only one of TaskDefinition or TaskImageOptions.');
    } else if (props.taskDefinition) {
      this.taskDefinition = props.taskDefinition;
    } else if (props.taskImageOptions) {
      const taskImageOptions = props.taskImageOptions;
      this.taskDefinition = new Ec2TaskDefinition(this, 'TaskDef', {
        executionRole: taskImageOptions.executionRole,
        taskRole: taskImageOptions.taskRole,
      });

      const containerName = taskImageOptions.containerName ?? 'web';
      const container = this.taskDefinition.addContainer(containerName, {
        image: taskImageOptions.image,
        cpu: props.cpu,
        memoryLimitMiB: props.memoryLimitMiB,
        memoryReservationMiB: props.memoryReservationMiB,
        environment: taskImageOptions.environment,
        secrets: taskImageOptions.secrets,
        logging: this.logDriver,
        dockerLabels: taskImageOptions.dockerLabels,
      });
      if (taskImageOptions.containerPorts) {
        for (const containerPort of taskImageOptions.containerPorts) {
          container.addPortMappings({
            containerPort,
          });
        }
      }
    } else {
      throw new Error('You must specify one of: taskDefinition or image');
    }
    if (!this.taskDefinition.defaultContainer) {
      throw new Error('At least one essential container must be specified');
    }
    if (this.taskDefinition.defaultContainer.portMappings.length === 0) {
      this.taskDefinition.defaultContainer.addPortMappings({
        containerPort: 80,
      });
    }

    this.service = this.createEc2Service(props);
    if (props.targetGroups) {
      for (const container of this.taskDefinition.containers) {
        this.registerECSTargets(this.service, container, props.targetGroups);
      }
    } else {
      for (const container of this.taskDefinition.containers) {
        for (const portMapping of container.portMappings) {
          if (portMapping.containerPort == ContainerDefinition.CONTAINER_PORT_USE_RANGE) {
            continue;
          }

          this.targetGroups.push(this.listener.addTargets(`${container.containerName}${portMapping.containerPort}`, {
            targets: [this.service],
            port: portMapping.containerPort,
          }));
        }
      }
    }

    if (this.targetGroups.length === 0) {
      throw new Error('At least one target group should be specified.');
    }
  }

  private createEc2Service(props: ApplicationMultipleTargetGroupsEc2ServiceProps): Ec2Service {
    const desiredCount = FeatureFlags.of(this).isEnabled(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT) ? this.internalDesiredCount : this.desiredCount;

    return new Ec2Service(this, 'Service', {
      cluster: this.cluster,
      desiredCount: desiredCount,
      taskDefinition: this.taskDefinition,
      assignPublicIp: false,
      serviceName: props.serviceName,
      healthCheckGracePeriod: props.healthCheckGracePeriod,
      propagateTags: props.propagateTags,
      enableECSManagedTags: props.enableECSManagedTags,
      cloudMapOptions: props.cloudMapOptions,
      enableExecuteCommand: props.enableExecuteCommand,
      placementConstraints: props.placementConstraints,
      placementStrategies: props.placementStrategies,
    });
  }
}
