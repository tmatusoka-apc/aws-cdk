#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EcsStack } from '../lib/ecs-stack';

const app = new cdk.App();

// -c env=dev から環境名を取得
const envKey = app.node.tryGetContext('env') || 'dev';
const config = app.node.tryGetContext(envKey);

if (!config) {
  throw new Error(`Context "${envKey}" is not defined in cdk.json`);
}

// cdk.json の中身を使用して環境を定義
const env = { 
  account: config.account, 
  region: config.region 
};

// 1. VPC Stack
const vpcStack = new VpcStack(app, `VpcStack-${envKey}`, {
  env,
  cidr: config.vpcCidr,
});

// 2. ECS Stack
new EcsStack(app, `EcsStack-${envKey}`, {
  env,
  vpc: vpcStack.vpc,
  cpu: config.cpu,
  memory: config.memory,
});

// CloudFormationテンプレートの書き出し
app.synth();