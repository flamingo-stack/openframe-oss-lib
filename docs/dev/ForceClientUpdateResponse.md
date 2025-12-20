# ForceClientUpdateResponse Documentation

## Overview
The `ForceClientUpdateResponse` class encapsulates the response structure for client updates. It contains a list of items that represent the details of the update responses.

## Core Responsibilities
- **Items**: Holds a list of `ForceClientUpdateResponseItem` objects that detail the updates.

## Code Snippet
```java
@Data
public class ForceClientUpdateResponse {
    private List<ForceClientUpdateResponseItem> items;
}
```

## Dependencies
- **ForceClientUpdateResponseItem**: Represents individual items in the update response.