package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalToolApi;
import com.openframe.test.data.dto.external.tool.ToolFilterResponse;
import com.openframe.test.data.dto.external.tool.ToolResponse;
import com.openframe.test.data.dto.external.tool.ToolsResponse;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** {@code /api/v1/tools} — the integrated-tool registry. Read-only and unpaginated. */
@Tag("external-api")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("ExtApi: External API - Tools")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalToolsTest extends ExternalApiBaseTest {

    @Tag("feature")
    @Tag("read")
    @Order(1)
    @Test
    @DisplayName("ExtApi: List integrated tools")
    public void testListTools() {
        ToolsResponse response = ExternalToolApi.listTools();

        assertThat(response.getTools()).as("Tenant should have integrated tools").isNotEmpty();
        assertThat(response.getTools()).allSatisfy(tool -> {
            assertThat(tool.getId()).as("Tool id should not be null").isNotNull();
            assertThat(tool.getName()).as("Tool name should not be empty").isNotEmpty();
            assertThat(tool.getEnabled()).as("Tool enabled flag should be set").isNotNull();
        });
    }

    @Tag("feature")
    @Tag("read")
    @Order(2)
    @Test
    @DisplayName("ExtApi: Get tool filter options")
    public void testGetToolFilters() {
        ToolFilterResponse filters = ExternalToolApi.getFilters();

        assertThat(filters).as("Filter response should not be null").isNotNull();
        // Every list is nullable in the contract; what must hold is that any value present is usable
        // as a filter, which the next case proves by round-tripping one.
        assertThat(filters.getTypes()).as("Types should not contain blanks").doesNotContainNull();
        assertThat(filters.getCategories()).as("Categories should not contain blanks").doesNotContainNull();
        assertThat(filters.getPlatformCategories()).as("Platform categories should not contain blanks")
                .doesNotContainNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(3)
    @Test
    @DisplayName("ExtApi: Filter tools by enabled flag")
    public void testFilterToolsByEnabled() {
        List<ToolResponse> enabled = ExternalToolApi.listTools(Map.of("enabled", true)).getTools();

        assertThat(enabled).as("Expected at least one enabled tool").isNotEmpty();
        assertThat(enabled).as("enabled=true must not return disabled tools")
                .allSatisfy(tool -> assertThat(tool.getEnabled()).isTrue());
    }

    @Tag("feature")
    @Tag("read")
    @Order(4)
    @Test
    @DisplayName("ExtApi: Filter tools by a value taken from the filter options")
    public void testFilterToolsByAdvertisedCategory() {
        ToolFilterResponse filters = ExternalToolApi.getFilters();
        List<String> categories = filters.getCategories();
        if (categories == null || categories.isEmpty()) {
            log.info("No tool categories advertised on this tenant; nothing to round-trip");
            return;
        }

        String category = categories.getFirst();
        List<ToolResponse> tools = ExternalToolApi.listTools(Map.of("category", category)).getTools();

        // The contract's promise is that an advertised filter value is a usable filter. A value the
        // filters endpoint offers but the list endpoint rejects or ignores would be the defect here.
        assertThat(tools).as("Category '%s' is advertised as a filter option, so it should match tools",
                category).isNotEmpty();
        assertThat(tools).as("Every returned tool should carry the requested category")
                .allSatisfy(tool -> assertThat(tool.getCategory()).isEqualTo(category));
    }
}
