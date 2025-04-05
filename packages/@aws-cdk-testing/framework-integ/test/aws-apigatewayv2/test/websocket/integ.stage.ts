#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-aws-apigatewayv2-websocket-stage');

const testLogGroup = new logs.LogGroup(stack, 'MyLogGroup');

const webSocketApi = new apigwv2.WebSocketApi(stack, 'WebSocketApi');
new apigwv2.WebSocketStage(stack, 'WebSocketStage', {
  webSocketApi,
  stageName: 'dev',
  throttle: {
    rateLimit: 1000,
    burstLimit: 1000,
  },
  detailedMetricsEnabled: true,
  description: 'My Stage',
  accessLogSettings: {
    destination: new apigwv2.LogGroupLogDestination(testLogGroup),
    format: apigw.AccessLogFormat.custom(JSON.stringify({
      extendedRequestId: apigw.AccessLogField.contextExtendedRequestId(),
      requestTime: apigw.AccessLogField.contextRequestTime(),
    })),
  },
});
