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

const vpcStack = new VpcStack(app, `VpcStack-${envKey}`, { env, cidr: config.vpcCidr });

new EcsStack(app, `EcsStack-${envKey}`, {
  env,
  vpc: vpcStack.vpc,
  activeColor: config.active_color,
  blueImage: config.blue_image,
  greenImage: config.green_image,
  cpu: config.cpu,      // ここで config から渡す
  memory: config.memory // ここで config から渡す
});

app.synth();