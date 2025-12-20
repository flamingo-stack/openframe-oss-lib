# MeshCentralAgentIdTransformer Documentation

## Overview
The `MeshCentralAgentIdTransformer` class is responsible for transforming agent tool IDs specific to the MeshCentral tool. It ensures that the IDs are formatted correctly for processing within the system.

## Core Methods
- **getToolType()**: Returns the tool type as `ToolType.MESHCENTRAL`.
- **transform(String agentToolId, boolean __)**: Transforms the provided agent tool ID by prefixing it with `node//`. If the ID is blank, it logs a warning and returns the original ID.

## Example Usage
```java
String transformedId = meshCentralAgentIdTransformer.transform("agent123", false);
```