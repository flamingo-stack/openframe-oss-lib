# MeshCentralAgentIdTransformer Documentation

## Overview
The `MeshCentralAgentIdTransformer` class is responsible for transforming agent tool IDs for MeshCentral, ensuring they are formatted correctly for processing.

## Methods
- **getToolType()**: Returns the tool type as `ToolType.MESHCENTRAL`.
- **transform(String agentToolId, boolean __)**: Transforms the provided agent tool ID by prefixing it with `node//`.