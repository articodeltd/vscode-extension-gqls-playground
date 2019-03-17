declare global {
  interface Window {
    schemaDSL: string;
  }
}

import GraphqlBirdseye from '@davidyaha/graphql-birdseye';

import { buildASTSchema, GraphQLSchema } from 'graphql';
import gql from 'graphql-tag';
import * as React from 'react';

interface State {
  schemaString?: string;
}

class App extends React.Component<{}, State> {
  private schema: GraphQLSchema | null;

  constructor() {
    super({});
    this.state = {};
    try {
      this.schema = this.getSchema(window.schemaDSL);
      this.setState({ schemaString: window.schemaDSL });
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log(e);
    }
  }

  public componentDidMount() {
    window.addEventListener('message', event => {
      const message = event.data; // The JSON data our extension sent

      switch (message.command) {
        case 'content-changed':
          this.setState({ schemaString: message.content });
          break;
      }
    });
  }

  public componentDidUpdate() {
    try {
      this.schema = this.getSchema(this.state.schemaString || '');
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log(e);
    }
  }

  public getSchema(schemaString: string) {
    return buildASTSchema(gql(schemaString));
  }

  public render() {
    if (!this.schema) {
      return <h1>No content yet...</h1>;
    }
    return (
      <div>
        <GraphqlBirdseye schema={this.schema} style={{ height: '100vh' }} />
      </div>
    );
  }
}

export default App;
