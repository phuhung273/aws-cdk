import * as path from 'path';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { IntegTest, ExpectedResult } from '@aws-cdk/integ-tests-alpha';
import { Construct } from 'constructs';
import * as lambda from '../lib';

class TestStack extends Stack {
  public readonly functionNames: string[] = [];
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pythonFunction39 = new lambda.PythonFunction(this, 'my_handler_inline_python_39', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_9,
    });
    this.functionNames.push(pythonFunction39.functionName);

    const pythonFunction310 = new lambda.PythonFunction(this, 'my_handler_inline_python_310', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_10,
    });
    this.functionNames.push(pythonFunction310.functionName);

    const pythonFunction311 = new lambda.PythonFunction(this, 'my_handler_inline_python_311', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_11,
    });
    this.functionNames.push(pythonFunction311.functionName);

    const pythonFunction312 = new lambda.PythonFunction(this, 'my_handler_inline_python_312', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_12,
    });
    this.functionNames.push(pythonFunction312.functionName);

    const pythonFunction313 = new lambda.PythonFunction(this, 'my_handler_inline_python_313', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_13,
    });
    this.functionNames.push(pythonFunction313.functionName);

    const pythonFunction39Excludes = new lambda.PythonFunction(this, 'my_handler_inline_excludes_python_39', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_9,
      bundling: {
        assetExcludes: ['.ignorefile'],
      },
    });
    this.functionNames.push(pythonFunction39Excludes.functionName);

    const pythonFunction310Excludes = new lambda.PythonFunction(this, 'my_handler_inline_excludes_python_310', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_10,
      bundling: {
        assetExcludes: ['.ignorefile'],
      },
    });
    this.functionNames.push(pythonFunction310Excludes.functionName);

    const pythonFunction311Excludes = new lambda.PythonFunction(this, 'my_handler_inline_excludes_python_311', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      runtime: Runtime.PYTHON_3_11,
      bundling: {
        assetExcludes: ['.ignorefile'],
      },
    });
    this.functionNames.push(pythonFunction311Excludes.functionName);

    const pythonFunction312Excludes = new lambda.PythonFunction(this, 'my_handler_inline_excludes_python_312', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      index: 'basic.py',
      runtime: Runtime.PYTHON_3_12,
      bundling: {
        assetExcludes: ['.ignorefile'],
      },
    });
    this.functionNames.push(pythonFunction312Excludes.functionName);

    const pythonFunction313Excludes = new lambda.PythonFunction(this, 'my_handler_inline_excludes_python_313', {
      entry: path.join(__dirname, 'lambda-handler-uv'),
      index: 'basic.py',
      runtime: Runtime.PYTHON_3_13,
      bundling: {
        assetExcludes: ['.ignorefile'],
      },
    });
    this.functionNames.push(pythonFunction313Excludes.functionName);
  }
}

const app = new App();
const testCase = new TestStack(app, 'integ-lambda-python-uv');

const integ = new IntegTest(app, 'uv', {
  testCases: [testCase],
  // disabling update workflow because we don't want to include the assets in the snapshot
  // python bundling changes the asset hash pretty frequently
  stackUpdateWorkflow: false,
});

testCase.functionNames.forEach(functionName => {
  const invoke = integ.assertions.invokeFunction({
    functionName: functionName,
  });

  invoke.expect(ExpectedResult.objectLike({
    Payload: '200',
  }));
});
