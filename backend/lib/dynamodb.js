import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ENV } from "../config/env.js";

let docClient;

export const getDocClient = () => {
  if (!docClient) {
    const client = new DynamoDBClient({ region: ENV.awsRegion });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
};

export const ddbGet = async (tableName, key) => {
  const res = await getDocClient().send(
    new GetCommand({ TableName: tableName, Key: key }),
  );
  return res.Item || null;
};

export const ddbPut = async (tableName, item) => {
  await getDocClient().send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
};

export const ddbUpdate = async (tableName, key, updates) => {
  const names = {};
  const values = {};
  const parts = [];

  Object.entries(updates).forEach(([field, value], i) => {
    const nameKey = `#f${i}`;
    const valueKey = `:v${i}`;
    names[nameKey] = field;
    values[valueKey] = value;
    parts.push(`${nameKey} = ${valueKey}`);
  });

  const res = await getDocClient().send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }),
  );
  return res.Attributes;
};

export const ddbDelete = async (tableName, key) => {
  await getDocClient().send(new DeleteCommand({ TableName: tableName, Key: key }));
};

export const ddbQueryBySession = async (tableName, sessionId, indexName = "bySession") => {
  const res = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: "sessionId = :sid",
      ExpressionAttributeValues: { ":sid": sessionId },
    }),
  );
  return res.Items || [];
};
