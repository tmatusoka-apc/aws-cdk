#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsStack } from '../lib/ecs-stack';

const app = new cdk.App();

const envKey = app.node.tryGetContext('env') || 'dev';
const config = app.node.tryGetContext(envKey);

if (!config) {
  throw new Error(`Context "${envKey}" is not defined in cdk.json`);
}

const env = { account: config.account, region: config.region };

// VPCスタックの作成
const vpcStack = new VpcStack(app, `VpcStack-${envKey}`, { env, cidr: config.vpcCidr });

// ECSスタックの作成（ECRリポジトリ名とタグを渡す）
new EcsStack(app, `EcsStack-${envKey}`, {
  env,
  vpc: vpcStack.vpc,
  activeColor: config.active_color,
  repositoryName: config.ecr_repository_name,
  blueImageTag: config.blue_image_tag,
  greenImageTag: config.green_image_tag,
  cpu: config.cpu,
  memory: config.memory
});

app.synth();