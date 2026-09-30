package com.openframe.test.tests;

import com.openframe.test.api.ToolApi;
import com.openframe.test.data.dto.tool.IntegratedTool;
import com.openframe.test.data.dto.tool.ToolFilterInput;
import com.openframe.test.data.dto.tool.ToolFilters;
import com.openframe.test.helpers.RelayIds;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// integratedTools and toolFilters on api/graphql (CP-48): the tenant's tool registry, read-only; the facets are the distinct non-null values and may all be empty.
@Tag("saas")
@Tag("integrated-tools")
@DisplayName("Integrated Tools")
public class IntegratedToolsTest extends BaseTest {

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("List integrated tools")
    public void testListIntegratedTools() {
        List<IntegratedTool> tools = ToolApi.getIntegratedTools();

        assertThat(tools).as("Every tenant registers its integrated tools at setup").isNotEmpty();
        assertThat(tools).allSatisfy(tool -> {
            assertThat(RelayIds.decode(tool.getId())).as("Tool id should be an IntegratedTool global id")
                    .startsWith("IntegratedTool:");
            assertThat(tool.getName()).as("Tool name should not be empty").isNotEmpty();
            assertThat(tool.getEnabled()).as("Tool enabled flag should be set").isNotNull();
        });
        assertThat(tools).extracting(IntegratedTool::getId).as("Tool ids should be unique").doesNotHaveDuplicates();
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Tool filters are the sorted distinct values of the tool list")
    public void testGetToolFilters() {
        ToolFilters filters = ToolApi.getToolFilters();
        List<IntegratedTool> tools = ToolApi.getIntegratedTools();

        assertThat(filters.getTypes()).as("Types facet")
                .containsExactlyElementsOf(distinct(tools, IntegratedTool::getType));
        assertThat(filters.getCategories()).as("Categories facet")
                .containsExactlyElementsOf(distinct(tools, IntegratedTool::getCategory));
        assertThat(filters.getPlatformCategories()).as("Platform categories facet")
                .containsExactlyElementsOf(distinct(tools, IntegratedTool::getPlatformCategory));
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Filter integrated tools by every advertised facet value")
    public void testFilterIntegratedToolsByAdvertisedFacets() {
        ToolFilters filters = ToolApi.getToolFilters();
        assumeTrue(!filters.getTypes().isEmpty() || !filters.getCategories().isEmpty()
                        || !filters.getPlatformCategories().isEmpty(),
                "No tool on this tenant carries a type, category or platform category, so no facet value is advertised");

        filters.getTypes().forEach(type -> assertFilteredBy(
                ToolApi.getIntegratedTools(ToolFilterInput.builder().type(type).build()),
                IntegratedTool::getType, type));
        filters.getCategories().forEach(category -> assertFilteredBy(
                ToolApi.getIntegratedTools(ToolFilterInput.builder().category(category).build()),
                IntegratedTool::getCategory, category));
        filters.getPlatformCategories().forEach(platformCategory -> assertFilteredBy(
                ToolApi.getIntegratedTools(ToolFilterInput.builder().platformCategory(platformCategory).build()),
                IntegratedTool::getPlatformCategory, platformCategory));
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Filter integrated tools by enabled flag")
    public void testFilterIntegratedToolsByEnabled() {
        List<IntegratedTool> all = ToolApi.getIntegratedTools();

        List<IntegratedTool> enabled = ToolApi.getIntegratedTools(ToolFilterInput.builder().enabled(true).build());
        List<IntegratedTool> disabled = ToolApi.getIntegratedTools(ToolFilterInput.builder().enabled(false).build());

        assertFilteredBy(enabled, IntegratedTool::getEnabled, true);
        assertThat(disabled).as("enabled=false must return only disabled tools")
                .allSatisfy(tool -> assertThat(tool.getEnabled()).isFalse());
        assertThat(enabled.size() + disabled.size()).as("enabled and disabled should partition the list")
                .isEqualTo(all.size());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Search integrated tools by name, case-insensitively")
    public void testSearchIntegratedTools() {
        IntegratedTool target = ToolApi.getIntegratedTools().getFirst();
        String search = target.getName().toUpperCase(Locale.ROOT);

        List<IntegratedTool> results = ToolApi.searchIntegratedTools(search);

        assertThat(results).extracting(IntegratedTool::getId)
                .as("Searching '%s' should find tool '%s'", search, target.getName())
                .contains(target.getId());
        assertThat(results).as("Every result should match '%s' on name or description", search)
                .allSatisfy(tool -> assertThat(containsIgnoreCase(tool.getName(), search)
                        || containsIgnoreCase(tool.getDescription(), search)).isTrue());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Search and filter combine as AND")
    public void testSearchAndFilterIntegratedTools() {
        IntegratedTool target = ToolApi.getIntegratedTools().getFirst();
        ToolFilterInput sameFlag = ToolFilterInput.builder().enabled(target.getEnabled()).build();
        ToolFilterInput oppositeFlag = ToolFilterInput.builder().enabled(!target.getEnabled()).build();

        assertThat(ToolApi.getIntegratedTools(sameFlag, target.getName())).extracting(IntegratedTool::getId)
                .as("Tool '%s' matches both its name and its own enabled flag", target.getName())
                .contains(target.getId());
        assertThat(ToolApi.getIntegratedTools(oppositeFlag, target.getName())).extracting(IntegratedTool::getId)
                .as("Tool '%s' must be excluded when the enabled filter contradicts it", target.getName())
                .doesNotContain(target.getId());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Unknown filter value and unmatched search return an empty list")
    public void testIntegratedToolsNoMatch() {
        String unknown = "no-such-tool-" + UUID.randomUUID();

        assertThat(ToolApi.getIntegratedTools(ToolFilterInput.builder().type(unknown).build()))
                .as("An unknown type should match no tools").isEmpty();
        assertThat(ToolApi.getIntegratedTools(ToolFilterInput.builder().category(unknown).build()))
                .as("An unknown category should match no tools").isEmpty();
        // Regex metacharacters are quoted server-side, so ".*(" must be taken literally.
        assertThat(ToolApi.searchIntegratedTools(unknown + ".*("))
                .as("An unmatched search containing regex metacharacters should match no tools").isEmpty();
    }

    private static <T> void assertFilteredBy(List<IntegratedTool> filtered, Function<IntegratedTool, T> field,
                                             T value) {
        List<String> expectedIds = ToolApi.getIntegratedTools().stream()
                .filter(tool -> value.equals(field.apply(tool)))
                .map(IntegratedTool::getId)
                .toList();

        assertThat(filtered).as("Filter value '%s' should match tools", value).isNotEmpty();
        assertThat(filtered).as("Every returned tool should carry '%s'", value)
                .allSatisfy(tool -> assertThat(field.apply(tool)).isEqualTo(value));
        assertThat(filtered).extracting(IntegratedTool::getId)
                .as("Filter '%s' should return exactly the tools of the unfiltered list that carry it", value)
                .containsExactlyInAnyOrderElementsOf(expectedIds);
    }

    private static List<String> distinct(List<IntegratedTool> tools, Function<IntegratedTool, String> field) {
        return tools.stream().map(field).filter(Objects::nonNull).distinct().sorted().toList();
    }

    private static boolean containsIgnoreCase(String text, String search) {
        return text != null && text.toLowerCase(Locale.ROOT).contains(search.toLowerCase(Locale.ROOT));
    }
}
