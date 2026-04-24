import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  activeColor: 'blue' | 'green';
  blueImage: string;
  greenImage: string;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc: props.vpc });

    // 1. 共通の NLB を作成
    const nlb = new elbv2.NetworkLoadBalancer(this, 'Nlb', {
      vpc: props.vpc,
      internetFacing: true,
    });

    // --- BLUE サービス定義 ---
    const blueTask = new ecs.FargateTaskDefinition(this, 'BlueTask', { cpu: 256, memoryLimitMiB: 512 });
    blueTask.addContainer('nginx', {
      image: ecs.ContainerImage.fromRegistry(props.blueImage),
      portMappings: [{ containerPort: 80 }],
    });
    const blueService = new ecs.FargateService(this, 'BlueService', {
      cluster,
      taskDefinition: blueTask,
      healthCheckGracePeriod: cdk.Duration.seconds(60), // ヘルスチェック猶予を追加
    });
    const blueTargetGroup = new elbv2.NetworkTargetGroup(this, 'BlueTG', {
      vpc: props.vpc,
      port: 80,
      targets: [blueService],
      healthCheck: { enabled: true, port: '80' },
    });

    // --- GREEN サービス定義 ---
    const greenTask = new ecs.FargateTaskDefinition(this, 'GreenTask', { cpu: 256, memoryLimitMiB: 512 });
    greenTask.addContainer('nginx', {
      image: ecs.ContainerImage.fromRegistry(props.greenImage),
      portMappings: [{ containerPort: 80 }],
    });
    const greenService = new ecs.FargateService(this, 'GreenService', {
      cluster,
      taskDefinition: greenTask,
      healthCheckGracePeriod: cdk.Duration.seconds(60), // ヘルスチェック猶予を追加
    });
    const greenTargetGroup = new elbv2.NetworkTargetGroup(this, 'GreenTG', {
      vpc: props.vpc,
      port: 80,
      targets: [greenService],
      healthCheck: { enabled: true, port: '80' },
    });

    // --- リスナー定義 ---
    // Blue確認用 (8000)
    nlb.addListener('BlueListener', { port: 8000 }).addTargetGroups('BlueTarget', blueTargetGroup);
    // Green確認用 (8080)
    nlb.addListener('GreenListener', { port: 8080 }).addTargetGroups('GreenTarget', greenTargetGroup);
    // 本番用 (80)
    const prodListener = nlb.addListener('ProdListener', { port: 80 });
    if (props.activeColor === 'green') {
      prodListener.addTargetGroups('ProdTarget', greenTargetGroup);
    } else {
      prodListener.addTargetGroups('ProdTarget', blueTargetGroup);
    }

    // --- セキュリティグループの許可設定 ---
    blueService.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Allow HTTP from everywhere');
    greenService.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Allow HTTP from everywhere');
  }
}