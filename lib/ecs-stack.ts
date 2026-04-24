import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  cpu: number;
  memory: number;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const loadBalancedFargateService = new ecs_patterns.NetworkLoadBalancedFargateService(this, 'MyNlbService', {
      vpc: props.vpc,
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("nginx"),
        containerPort: 80,
      },
      listenerPort: 8080,
      assignPublicIp: false,
      publicLoadBalancer: true,
      // ★ 起動直後のヘルスチェック失敗を許容する時間を設定（60秒）
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // ★ セキュリティグループの設定
    // NLBはセキュリティグループを持ちませんが、Fargateタスク側でVPC内（NLB経由）からの80番ポート通信を許可する必要があります
    loadBalancedFargateService.service.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Allow HTTP from everywhere');

    // ターゲットグループのヘルスチェック設定を微調整
    loadBalancedFargateService.targetGroup.configureHealthCheck({
      enabled: true,
      port: '80', // コンテナのポートをチェック
    });
  }
}