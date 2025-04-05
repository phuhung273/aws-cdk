import { App, Stack } from 'aws-cdk-lib';
import { ExpectedResult, IntegTest } from '../../../lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';

const app = new App();
const stack = new Stack(app, 'assertion-additional-policy');

const api = new apigw.RestApi(stack, 'test-api');
api.root.addResource('pets').addMethod('GET');

const integTest = new IntegTest(app, 'assertion-additional-policy-test', {
  testCases: [stack],
});

integTest.assertions.awsApiCall('apigateway', 'getRestApi', {
  restApiId: api.restApiId,
}).expect(ExpectedResult.objectLike({
  id: api.restApiId,
}));
