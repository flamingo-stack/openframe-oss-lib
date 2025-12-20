# CountedGenericQueryResult

## Overview
The `CountedGenericQueryResult` class extends the `GenericQueryResult` class to include an additional field for filtered count. This is particularly useful for paginated responses where the total number of filtered results is needed.

## Key Responsibilities
- **Filtered Count**: Holds the count of filtered results.

## Code Snippet
```java
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CountedGenericQueryResult<T> extends GenericQueryResult<T> {
    private int filteredCount;
}
```

## Dependencies
- `GenericQueryResult`: The base class that this class extends.