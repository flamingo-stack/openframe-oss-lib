# Testing Overview

This guide describes the testing strategy, structure, and conventions used across **openframe-oss-lib**.

---

## Test Structure and Organization

Tests are co-located with their source code in the standard Maven layout:

```text
openframe-<module>/
├── src/
│   ├── main/java/com/openframe/...        # Production code
│   └── test/java/com/openframe/...        # Test code
│       ├── com/openframe/.../FooTest.java  # Unit test
│       └── com/openframe/.../FooIT.java    # Integration test
```

### Naming Conventions

| Convention | Type | Lifecycle Phase |
|-----------|------|----------------|
| `*Test.java` | Unit test | `mvn test` (Surefire) |
| `*Tests.java` | Unit test | `mvn test` (Surefire) |
| `*TestCase.java` | Unit test | `mvn test` (Surefire) |
| `*IT.java` | Integration test | `mvn verify` (Failsafe) |

The Maven Surefire plugin in the parent POM is configured to include all four patterns:

```xml
<includes>
    <include>**/Test*.java</include>
    <include>**/*Test.java</include>
    <include>**/*Tests.java</include>
    <include>**/*TestCase.java</include>
    <include>**/*IT.java</include>
</includes>
```

---

## Running Tests

### All Unit Tests

```bash
# Run all unit tests across the entire project
mvn test

# Run unit tests for a specific module
mvn test -pl openframe-core
mvn test -pl openframe-data-nats
mvn test -pl openframe-data-pinot
```

### Integration Tests

Integration tests require a running Docker daemon (Testcontainers):

```bash
# Run integration tests for a specific module
mvn verify -pl openframe-data-mongo-sync

# Run integration + unit tests for a module
mvn verify -pl openframe-api-service-core

# Run all integration tests (may be slow — requires Docker)
mvn verify
```

### Skipping Tests

```bash
# Skip all tests during build
mvn install -DskipTests

# Skip integration tests only
mvn install -DskipITs

# Run only unit tests (skip integration)
mvn test -DskipITs
```

---

## Integration Test Infrastructure

### Testcontainers

Integration tests use [Testcontainers](https://testcontainers.com/) for infrastructure dependencies. Containers are automatically started and stopped per test class or suite.

**MongoDB Integration Tests:**

```java
// Base class pattern used in openframe-data-mongo-sync
@SpringBootTest(classes = IntegrationTestApplication.class)
@ActiveProfiles("integration")
public abstract class BaseMongoIntegrationTest {
    // Testcontainers manages MongoDB lifecycle
}
```

**NATS Integration Tests:**

```java
// Base class pattern in openframe-data-nats
@SpringBootTest(classes = PublisherIntegrationTestApplication.class)
public abstract class BaseIntegrationTest {
    // Testcontainers manages NATS lifecycle
}
```

### Docker Compose (Alternative)

For manual testing sessions, a Docker Compose file is available for MongoDB:

```bash
cd openframe-data-mongo-sync/src/test/docker
docker-compose up -d
```

---

## Test Utilities

### `openframe-test-service-core`

This dedicated module provides reusable test infrastructure for **end-to-end and integration testing** of OpenFrame services:

| Class | Purpose |
|-------|---------|
| `AuthHelper` | Authentication flow helpers |
| `RequestSpecHelper` | REST-Assured request specification builders |
| `AuthGenerator` | Generate test authentication tokens |
| `OrganizationGenerator` | Generate test organization data |
| `DeviceGenerator` | Generate test device data |
| `TicketGenerator` | Generate test ticket data |
| `NotificationFixtures` | Pre-built notification test data |

Example usage:

```java
@Autowired
private OrganizationGenerator organizationGenerator;

@Test
void shouldCreateOrganization() {
    var org = organizationGenerator.createOrganization("Test Org");
    assertThat(org.getId()).isNotNull();
}
```

### GraphQL Test Helpers

GraphQL integration tests use pre-built query helpers:

```java
// Available in openframe-test-service-core
DeviceQueries.listDevices(filterInput)
OrganizationQueries.listOrganizations(filterInput)
TicketQueries.listTickets(filterInput)
```

---

## Writing New Tests

### Unit Test Template

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MyServiceTest {

    @Mock
    private MyRepository repository;

    @InjectMocks
    private MyService service;

    @Test
    void shouldReturnExpectedResult() {
        // Given
        when(repository.findById("id-1")).thenReturn(Optional.of(new MyEntity("id-1")));

        // When
        var result = service.getById("id-1");

        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo("id-1");
    }
}
```

### Integration Test Template (MongoDB)

```java
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MyRepositoryIT extends BaseMongoIntegrationTest {

    @Autowired
    private MyRepository repository;

    @AfterEach
    void cleanup() {
        repository.deleteAll();
    }

    @Test
    void shouldPersistAndRetrieveEntity() {
        // Given
        var entity = new MyEntity("test-id", "test-name");
        repository.save(entity);

        // When
        var found = repository.findById("test-id");

        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("test-name");
    }
}
```

### Naming and Structure Conventions

- Use **Given / When / Then** structure in test methods
- Test method names should describe behavior: `shouldReturnNotFoundWhenEntityDoesNotExist`
- One assertion concept per test where possible
- Always clean up test data in `@AfterEach` for integration tests
- Use `@DisplayName` for complex test scenarios

---

## Test Coverage

The project does not enforce a specific line coverage percentage, but the following guidelines apply:

| Component Type | Expected Coverage |
|---------------|------------------|
| Core utilities (`openframe-core`, `openframe-exception`) | High (>80%) |
| Domain services | Medium-High (>70%) |
| Configuration classes | Low (Spring-managed beans) |
| Repository implementations | Covered by integration tests |

Focus on **behavioral coverage** (testing what the code does) over line coverage metrics.

---

## Notification Integration Tests

The notification subsystem has particularly thorough integration test coverage in `openframe-data-mongo-sync`:

| Test Class | What It Tests |
|-----------|--------------|
| `NotificationContextDispatchIT` | Notification dispatch with custom context |
| `NotificationReadStateIndexesIT` | MongoDB index usage for read state |
| `NotificationLoadTestIT` | Load and performance testing |
| `NotificationReadStateIndexUsageIT` | Query plan analysis |
| `CustomNotificationRepositoryPaginationIT` | Cursor-based notification pagination |

Run them with:

```bash
mvn verify -pl openframe-data-mongo-sync -Dtest=Notification*IT
```

---

## Pinot Repository Tests

The `openframe-data-pinot` module contains unit tests for query building:

```bash
mvn test -pl openframe-data-pinot
```

Key test classes:

- `PinotQueryBuilderTest` — Validates SQL query generation
- `PinotClientDeviceRepositoryTest` — Device query logic
- `PinotClientLogRepositoryTest` — Log query logic
