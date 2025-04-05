import { Match, Template } from '../../../assertions';
import * as apigateway from '../../../aws-apigateway';
import { User } from '../../../aws-iam';
import * as logs from '../../../aws-logs';
import { Lazy, Stack } from '../../../core';
import { LogGroupLogDestination, WebSocketApi, WebSocketStage } from '../../lib';

let stack: Stack;
let api: WebSocketApi;

beforeEach(() => {
  stack = new Stack();
  api = new WebSocketApi(stack, 'Api');
});

describe('WebSocketStage', () => {
  test('default', () => {
    // WHEN
    const defaultStage = new WebSocketStage(stack, 'Stage', {
      webSocketApi: api,
      stageName: 'dev',
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.apiId),
      StageName: 'dev',
    });
    expect(defaultStage.url.endsWith('/dev')).toBe(true);
  });

  test('import', () => {
    // WHEN
    const stage = new WebSocketStage(stack, 'Stage', {
      webSocketApi: api,
      stageName: 'dev',
    });

    const imported = WebSocketStage.fromWebSocketStageAttributes(stack, 'Import', {
      stageName: stage.stageName,
      api,
    });

    // THEN
    expect(imported.stageName).toEqual(stage.stageName);
    expect(() => imported.url).toThrow();
    expect(() => imported.callbackUrl).toThrow();
  });

  test('callback URL', () => {
    // WHEN
    const defaultStage = new WebSocketStage(stack, 'Stage', {
      webSocketApi: api,
      stageName: 'dev',
    });

    // THEN
    expect(defaultStage.callbackUrl.endsWith('/dev')).toBe(true);
    expect(defaultStage.callbackUrl.startsWith('https://')).toBe(true);
  });

  describe('grantManageConnections', () => {
    test('adds an IAM policy to the principal', () => {
      // GIVEN
      const defaultStage = new WebSocketStage(stack, 'Stage', {
        webSocketApi: api,
        stageName: 'dev',
      });
      const principal = new User(stack, 'User');

      // WHEN
      defaultStage.grantManagementApiAccess(principal);

      // THEN
      Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([{
            Action: 'execute-api:ManageConnections',
            Effect: 'Allow',
            Resource: {
              'Fn::Join': ['', [
                'arn:',
                {
                  Ref: 'AWS::Partition',
                },
                ':execute-api:',
                {
                  Ref: 'AWS::Region',
                },
                ':',
                {
                  Ref: 'AWS::AccountId',
                },
                ':',
                {
                  Ref: 'ApiF70053CD',
                },
                `/${defaultStage.stageName}/*/@connections/*`,
              ]],
            },
          }]),
        },
      });
    });
  });

  test('correctly sets throttle settings', () => {
    // WHEN
    new WebSocketStage(stack, 'DefaultStage', {
      webSocketApi: api,
      stageName: 'dev',
      throttle: {
        burstLimit: 1000,
        rateLimit: 1000,
      },
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.apiId),
      StageName: 'dev',
      DefaultRouteSettings: {
        ThrottlingBurstLimit: 1000,
        ThrottlingRateLimit: 1000,
      },
    });
  });

  test('correctly sets details metrics settings', () => {
    // WHEN
    new WebSocketStage(stack, 'DefaultStage', {
      webSocketApi: api,
      stageName: 'dev',
      detailedMetricsEnabled: true,
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.apiId),
      StageName: 'dev',
      DefaultRouteSettings: {
        DetailedMetricsEnabled: true,
      },
    });
  });

  test('correctly sets route settings', () => {
    // WHEN
    new WebSocketStage(stack, 'DefaultStage', {
      webSocketApi: api,
      stageName: 'dev',
      throttle: {
        burstLimit: 1000,
        rateLimit: 1000,
      },
      detailedMetricsEnabled: true,
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      ApiId: stack.resolve(api.apiId),
      StageName: 'dev',
      DefaultRouteSettings: {
        ThrottlingBurstLimit: 1000,
        ThrottlingRateLimit: 1000,
        DetailedMetricsEnabled: true,
      },
    });
  });

  test('specify description', () => {
    // WHEN
    new WebSocketStage(stack, 'DefaultStage', {
      webSocketApi: api,
      stageName: 'dev',
      description: 'My Stage',
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      Description: 'My Stage',
    });
  });

  test('if only the custom log destination log group is set', () => {
    // WHEN
    const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
    new WebSocketStage(stack, 'my-stage', {
      webSocketApi: api,
      stageName: 'dev',
      accessLogSettings: {
        destination: new LogGroupLogDestination(testLogGroup),
      },
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      AccessLogSettings: {
        DestinationArn: {
          'Fn::GetAtt': [
            'LogGroupF5B46931',
            'Arn',
          ],
        },
        Format: '$context.identity.sourceIp $context.identity.caller $context.identity.user [$context.requestTime] "$context.httpMethod $context.resourcePath $context.protocol" $context.status $context.responseLength $context.requestId',
      },
    });
  });

  test('if the custom log destination log group and format is set', () => {
    // WHEN
    const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
    const testFormat = apigateway.AccessLogFormat.jsonWithStandardFields();
    new WebSocketStage(stack, 'my-stage', {
      webSocketApi: api,
      stageName: 'dev',
      accessLogSettings: {
        destination: new LogGroupLogDestination(testLogGroup),
        format: testFormat,
      },
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      AccessLogSettings: {
        DestinationArn: {
          'Fn::GetAtt': [
            'LogGroupF5B46931',
            'Arn',
          ],
        },
        Format: '{"requestId":"$context.requestId","ip":"$context.identity.sourceIp","user":"$context.identity.user","caller":"$context.identity.caller","requestTime":"$context.requestTime","httpMethod":"$context.httpMethod","resourcePath":"$context.resourcePath","status":"$context.status","protocol":"$context.protocol","responseLength":"$context.responseLength"}',
      },
    });
  });

  describe('access log check', () => {
    test('fails when access log format does not contain `contextRequestId()` or `contextExtendedRequestId()', () => {
      // WHEN
      const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
      const testFormat = apigateway.AccessLogFormat.custom('');

      // THEN
      expect(() => new WebSocketStage(stack, 'my-stage', {
        webSocketApi: api,
        stageName: 'dev',
        accessLogSettings: {
          destination: new LogGroupLogDestination(testLogGroup),
          format: testFormat,
        },
      })).toThrow('Access log must include either `AccessLogFormat.contextRequestId()` or `AccessLogFormat.contextExtendedRequestId()`');
    });

    test('succeeds when access log format contains `contextRequestId()`', () => {
      // WHEN
      const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
      const testFormat = apigateway.AccessLogFormat.custom(JSON.stringify({
        requestId: apigateway.AccessLogField.contextRequestId(),
      }));

      // THEN
      expect(() => new WebSocketStage(stack, 'my-stage', {
        webSocketApi: api,
        stageName: 'dev',
        accessLogSettings: {
          destination: new LogGroupLogDestination(testLogGroup),
          format: testFormat,
        },
      })).not.toThrow();
    });

    test('succeeds when access log format contains `contextExtendedRequestId()`', () => {
      // WHEN
      const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
      const testFormat = apigateway.AccessLogFormat.custom(JSON.stringify({
        extendedRequestId: apigateway.AccessLogField.contextExtendedRequestId(),
      }));

      // THEN
      expect(() => new WebSocketStage(stack, 'my-stage', {
        webSocketApi: api,
        stageName: 'dev',
        accessLogSettings: {
          destination: new LogGroupLogDestination(testLogGroup),
          format: testFormat,
        },
      })).not.toThrow();
    });

    test('succeeds when access log format contains both `contextRequestId()` and `contextExtendedRequestId`', () => {
      // WHEN
      const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
      const testFormat = apigateway.AccessLogFormat.custom(JSON.stringify({
        requestId: apigateway.AccessLogField.contextRequestId(),
        extendedRequestId: apigateway.AccessLogField.contextExtendedRequestId(),
      }));

      // THEN
      expect(() => new WebSocketStage(stack, 'my-stage', {
        webSocketApi: api,
        stageName: 'dev',
        accessLogSettings: {
          destination: new LogGroupLogDestination(testLogGroup),
          format: testFormat,
        },
      })).not.toThrow();
    });

    test('fails when access log format contains `contextRequestIdXxx`', () => {
      // WHEN
      const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
      const testFormat = apigateway.AccessLogFormat.custom(JSON.stringify({
        requestIdXxx: '$context.requestIdXxx',
      }));

      // THEN
      expect(() => new WebSocketStage(stack, 'my-stage', {
        webSocketApi: api,
        stageName: 'dev',
        accessLogSettings: {
          destination: new LogGroupLogDestination(testLogGroup),
          format: testFormat,
        },
      })).toThrow('Access log must include either `AccessLogFormat.contextRequestId()` or `AccessLogFormat.contextExtendedRequestId()`');
    });

    test('does not fail when access log format is a token', () => {
      // WHEN
      const testLogGroup = new logs.LogGroup(stack, 'LogGroup');
      const testFormat = apigateway.AccessLogFormat.custom(Lazy.string({ produce: () => 'test' }));

      // THEN
      expect(() => new WebSocketStage(stack, 'my-stage', {
        webSocketApi: api,
        stageName: 'dev',
        accessLogSettings: {
          destination: new LogGroupLogDestination(testLogGroup),
          format: testFormat,
        },
      })).not.toThrow();
    });
  });
});
