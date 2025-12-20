# HostSearchResponse Documentation

## Overview
The `HostSearchResponse` class is a response wrapper for host search results from Fleet MDM. It includes pagination and sorting information along with the list of hosts.

## Core Responsibilities
- **Hosts**: List of hosts returned from the search.
- **Pagination**: Contains fields for pagination such as `page`, `perPage`, `orderKey`, and `orderDirection`.

## Code Snippet
```java
@JsonIgnoreProperties(ignoreUnknown = true)
public class HostSearchResponse {
    private List<Host> hosts;
    private Integer page;
    private Integer perPage;
    private String orderKey;
    private String orderDirection;
    private String query;
}
```

## Dependencies
- **Host**: Represents individual host details.