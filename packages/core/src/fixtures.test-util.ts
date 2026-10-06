import {
  GRAPH_SCHEMA_VERSION,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type NodeType,
} from './graph.js';

export function node(
  key: string,
  type: NodeType,
  config: Record<string, unknown> = {},
): GraphNode {
  return { id: key, key, type, title: key, position: { x: 0, y: 0 }, config };
}

export function edge(
  from: string,
  to: string,
  fromPort = 'out',
  toPort = 'in',
): GraphEdge {
  return {
    id: `${from}:${fromPort}->${to}:${toPort}`,
    from: { node: from, port: fromPort },
    to: { node: to, port: toPort },
  };
}

export function graph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  return { schemaVersion: GRAPH_SCHEMA_VERSION, nodes, edges };
}

// 비 알림 예시 흐름: trigger → weather → cond(참) → msg → notify
export function rainFlow(): Graph {
  return graph(
    [
      node('trigger_1', 'trigger'),
      node('weather_1', 'http', {
        url: 'https://api.example.com/weather?city={{ city }}',
      }),
      node('cond_1', 'condition', { expression: 'body.rain > 60' }),
      node('msg_1', 'transform', {
        expression: '"비 올 확률 " & $string(body.rain) & "%"',
      }),
      node('notify_1', 'http', {
        method: 'POST',
        url: '{{ $secrets.DISCORD }}',
        body: '{ "content": $nodes.msg_1 }',
      }),
    ],
    [
      edge('trigger_1', 'weather_1'),
      edge('weather_1', 'cond_1'),
      edge('cond_1', 'msg_1', 'true'),
      edge('msg_1', 'notify_1'),
    ],
  );
}
