import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  activeColor: 'blue' | 'green';
  repositoryName: string;
  blueImageTag: string;
  greenImageTag: string;
  cpu: number;
  memory: number;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // ECSクラスター
    const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc: props.vpc });

    // 同一アカウント内の既存ECRリポジトリを参照
    const repository = ecr.Repository.fromRepositoryName(this, 'Repo', props.repositoryName);

    // 共通の NLB
    const nlb = new elbv2.NetworkLoadBalancer(this, 'Nlb', {
      vpc: props.vpc,
      internetFacing: true,
    });

    // --- BLUE サービス ---
    const blueTask = new ecs.FargateTaskDefinition(this, 'BlueTask', { cpu: props.cpu, memoryLimitMiB: props.memory });
    blueTask.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(repository, props.blueImageTag),
      portMappings: [{ containerPort: 80 }],
    });
    const blueService = new ecs.FargateService(this, 'BlueService', {
      cluster,
      taskDefinition: blueTask,
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }, // NAT Gateway経由でプル
    });
    const blueTargetGroup = new elbv2.NetworkTargetGroup(this, 'BlueTG', {
      vpc: props.vpc,
      port: 80,
      targets: [blueService],
    });

    // --- GREEN サービス ---
    const greenTask = new ecs.FargateTaskDefinition(this, 'GreenTask', { cpu: props.cpu, memoryLimitMiB: props.memory });
    greenTask.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(repository, props.greenImageTag),
      portMappings: [{ containerPort: 80 }],
    });
    const greenService = new ecs.FargateService(this, 'GreenService', {
      cluster,
      taskDefinition: greenTask,
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    const greenTargetGroup = new elbv2.NetworkTargetGroup(this, 'GreenTG', {
      vpc: props.vpc,
      port: 80,
      targets: [greenService],
    });

    // --- リスナー設定 ---
    // 8000ポート: 常に Blue を見る
    nlb.addListener('BlueListener', { port: 8000 }).addTargetGroups('BlueTarget', blueTargetGroup);
    // 8080ポート: 常に Green を見る
    nlb.addListener('GreenListener', { port: 8080 }).addTargetGroups('GreenTarget', greenTargetGroup);
    
    // 80ポート（本番）: active_color によって向き先を切り替え
    const prodListener = nlb.addListener('ProdListener', { port: 80 });
    if (props.activeColor === 'green') {
      prodListener.addTargetGroups('ProdTarget', greenTargetGroup);
    } else {
      prodListener.addTargetGroups('ProdTarget', blueTargetGroup);
    }

    // セキュリティグループ設定
    blueService.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    greenService.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
  }
}