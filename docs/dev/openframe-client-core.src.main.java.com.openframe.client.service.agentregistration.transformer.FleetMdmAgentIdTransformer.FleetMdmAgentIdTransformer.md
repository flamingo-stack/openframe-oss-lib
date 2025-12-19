# FleetMdmAgentIdTransformer Documentation

## Overview
The `FleetMdmAgentIdTransformer` class is responsible for transforming agent IDs specifically for the Fleet MDM tool. It implements the `ToolAgentIdTransformer` interface.

## Core Responsibilities
- **Transform Agent IDs**: Transforms agent IDs based on the Fleet MDM tool's configuration and data.

## Methods
### `String transform(String agentToolId, boolean lastAttempt)`
- **Parameters**:
  - `agentToolId`: The original agent tool ID to be transformed.
  - `lastAttempt`: A flag indicating if this is the last attempt to transform the ID.
- **Returns**: The transformed agent tool ID or the original ID if no transformation is applicable.