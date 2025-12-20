# GenericQueryResult Documentation

## Overview
The `GenericQueryResult` class is a generic data transfer object that encapsulates a list of items along with pagination information.

### Core Components
- **Items**: A list of items of type `T`.
- **PageInfo**: Contains pagination details such as current page, total pages, etc.

### Example Usage
```java
GenericQueryResult<MyType> result = GenericQueryResult.<MyType>builder()
    .items(myItemList)
    .pageInfo(myPageInfo)
    .build();
```

## Dependencies
- `CursorPageInfo`: This class is used to provide pagination details.