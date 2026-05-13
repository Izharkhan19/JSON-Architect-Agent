/**
 * Convert the internal tree structure to a JSON object
 */
export function treeToJson(nodes) {
  const result = {};
  for (const node of nodes) {
    if (!node.key && node.type !== 'object' && node.type !== 'array') continue;
    const key = node.key || `field_${node.id.slice(0, 4)}`;
    result[key] = nodeToValue(node);
  }
  return result;
}

/**
 * Convert a single node to its JSON value
 */
function nodeToValue(node) {
  switch (node.type) {
    case 'string':
      return node.value ?? '';
    case 'number':
      return node.value ?? 0;
    case 'boolean':
      return node.value ?? false;
    case 'null':
      return null;
    case 'object': {
      const obj = {};
      if (node.children) {
        for (const child of node.children) {
          const childKey = child.key || `field_${child.id.slice(0, 4)}`;
          obj[childKey] = nodeToValue(child);
        }
      }
      return obj;
    }
    case 'array': {
      if (node.items?.children?.length > 0) {
        return node.items.children.map(nodeToValue);
      }
      return [];
    }
    default:
      return null;
  }
}

/**
 * Convert JSON back to tree nodes
 */
export function jsonToTree(json) {
  const { createNode } = require('./treeUtils');
  return parseValue(json, '', createNode);
}

function parseValue(value, key, createNode) {
  if (value === null) {
    return [createNode('null', key)];
  }
  if (Array.isArray(value)) {
    const node = createNode('array', key);
    node.items = {
      type: value.length > 0 ? typeof value[0] : 'string',
      children: value.map((item, i) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const objNode = createNode('object', `[${i}]`);
          objNode.children = Object.entries(item).flatMap(([k, v]) =>
            parseValueSingle(v, k, createNode)
          );
          return objNode;
        }
        return parseValueSingle(item, `[${i}]`, createNode);
      }),
    };
    return [node];
  }
  if (typeof value === 'object') {
    const node = createNode('object', key);
    node.children = Object.entries(value).flatMap(([k, v]) =>
      parseValueSingle(v, k, createNode)
    );
    return [node];
  }
  return [createNode(typeof value, key, { value })];
}

function parseValueSingle(value, key, createNode) {
  if (value === null) return createNode('null', key);
  if (Array.isArray(value)) {
    const node = createNode('array', key);
    node.items = {
      type: 'string',
      children: value.map((item, i) => parseValueSingle(item, `[${i}]`, createNode)),
    };
    return node;
  }
  if (typeof value === 'object') {
    const node = createNode('object', key);
    node.children = Object.entries(value).flatMap(([k, v]) =>
      parseValueSingle(v, k, createNode)
    );
    return node;
  }
  return createNode(typeof value, key, { value });
}

/**
 * Pretty-print JSON with syntax highlighting spans
 */
export function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  json = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}
