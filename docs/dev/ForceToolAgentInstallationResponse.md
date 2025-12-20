# ForceToolAgentInstallationResponse

## Overview
The `ForceToolAgentInstallationResponse` class represents the response structure for force tool agent installations. It contains a list of items that detail the results of the installation process.

## Key Responsibilities
- **Items**: Holds a list of `ForceToolAgentInstallationResponseItem` objects that represent the results of the installation.

## Code Snippet
```java
@Data
public class ForceToolAgentInstallationResponse {
    private List<ForceToolAgentInstallationResponseItem> items;
}
```

## Dependencies
- `ForceToolAgentInstallationResponseItem`: Represents an individual item in the installation response.