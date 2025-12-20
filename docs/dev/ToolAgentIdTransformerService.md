# ToolAgentIdTransformerService Documentation

## Overview
The `ToolAgentIdTransformerService` is responsible for transforming agent IDs based on the tool type. It utilizes a list of transformers to perform the transformation.

## Core Responsibilities
- **Transform Agent IDs**: The main function of this service is to transform agent tool IDs based on the provided tool type.

## Code Example
```java
public String transform(ToolType toolType, String agentToolId, boolean lastAttempt) {
    return transformers.stream()
            .filter(transformer -> toolType.equals(transformer.getToolType()))
            .findFirst()
            .map(transformer -> transformer.transform(agentToolId, lastAttempt))
            .orElse(agentToolId);
}
```