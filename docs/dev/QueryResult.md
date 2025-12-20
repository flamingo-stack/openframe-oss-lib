# QueryResult Documentation

## Overview
The `QueryResult` class represents the result of a Fleet MDM query execution. It includes details such as the host ID, rows returned, and execution status.

## Properties
- `hostId`: The ID of the host for which the query was executed.
- `rows`: A list of rows returned by the query.
- `error`: Any error message returned during query execution.
- `status`: The status of the query execution.
- `query`: The original query string.
- `executedAt`: The timestamp when the query was executed.

## Methods
- `isSuccess()`: Checks if the query executed successfully.
- `getRowCount()`: Returns the number of rows returned by the query.