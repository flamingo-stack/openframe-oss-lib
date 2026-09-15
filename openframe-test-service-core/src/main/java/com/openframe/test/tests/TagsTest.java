package com.openframe.test.tests;

import com.openframe.test.api.TagApi;
import com.openframe.test.data.dto.tag.TagDefinition;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tag definitions over the GraphQL API (coverage plan item CP-15): a device tag of this run's own is
 * edited, listed per entity type and deleted, and the key/value suggestion queries the device tag
 * picker uses are read (they are scoped to DEVICE tags, tenant-wide). Ticket and knowledge-base tags
 * are created by their own suites.
 */
@Tag("saas")
@DisplayName("Tags")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagsTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final String KEY = "E2E_" + RUN_ID.value().replace("-", "_").toUpperCase();

    private static TagDefinition tag;

    @Tag("feature")
    @Test
    @DisplayName("Edit a device tag and list it by entity type")
    @Order(1)
    public void testEditAndListScriptTag() {
        tag = TagApi.createTag(KEY, "DEVICE", "created by the E2E suite", "#3B82F6");
        assertThat(tag.getId()).as("Created tag id should not be blank").isNotBlank();
        assertThat(tag.getEntityType()).as("The tag is a DEVICE tag").isEqualTo("DEVICE");

        TagDefinition edited = TagApi.updateTag(tag.getId(), null, "edited by the E2E suite", "#22C55E");
        assertThat(edited.getId()).as("Editing keeps the id").isEqualTo(tag.getId());
        assertThat(edited.getKey()).as("An omitted key is kept").isEqualTo(KEY);
        assertThat(edited.getDescription()).as("The description is updated").isEqualTo("edited by the E2E suite");
        assertThat(edited.getColor()).as("The color is updated").isEqualTo("#22C55E");

        List<TagDefinition> deviceTags = TagApi.tagsByEntityType("DEVICE");
        assertThat(deviceTags).extracting(TagDefinition::getId).as("The tag is listed under DEVICE").contains(tag.getId());
        assertThat(deviceTags).allSatisfy(t -> assertThat(t.getEntityType()).as("Only DEVICE tags are listed").isEqualTo("DEVICE"));
        assertThat(TagApi.tagsByEntityType("SCRIPT")).extracting(TagDefinition::getId)
                .as("A DEVICE tag is not listed under SCRIPT").doesNotContain(tag.getId());
        List<TagDefinition> scriptsTags = TagApi.scriptsTags(false);
        assertThat(scriptsTags).as("The scripts tag list resolves").isNotNull();
        assertThat(scriptsTags).extracting(TagDefinition::getId).as("A DEVICE tag is not a scripts tag").doesNotContain(tag.getId());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Suggest tag keys and values")
    @Order(2)
    public void testSuggestions() {
        List<TagDefinition> all = TagApi.tagKeySuggestions(null, 100);
        assertThat(all).as("Key suggestions include this run's tag").extracting(TagDefinition::getKey).contains(KEY);
        String prefix = KEY.substring(0, 6);
        List<TagDefinition> narrowed = TagApi.tagKeySuggestions(prefix, 50);
        assertThat(narrowed).extracting(TagDefinition::getKey).as("A prefix search finds the tag").contains(KEY);
        assertThat(narrowed).allSatisfy(t -> assertThat(t.getKey().toUpperCase()).as("Every suggestion matches the search").contains(prefix));

        List<String> values = TagApi.tagValueSuggestions(KEY, null, 10);
        assertThat(values).as("A tag with no values suggests none").isEmpty();
        TagDefinition withValues = all.stream().filter(t -> t.getValues() != null && !t.getValues().isEmpty()).findFirst().orElse(null);
        if (withValues != null) {
            assertThat(TagApi.tagValueSuggestions(withValues.getKey(), null, 50))
                    .as("Value suggestions for " + withValues.getKey() + " include its stored values")
                    .containsAnyElementsOf(withValues.getValues());
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("Delete a device tag")
    @Order(3)
    public void testDeleteTag() {
        assertThat(tag).as("The tag from the first case").isNotNull();
        assertThat(TagApi.deleteTag(tag.getId())).as("Deleting an existing tag returns true").isTrue();
        assertThat(TagApi.tagsByEntityType("DEVICE")).extracting(TagDefinition::getId)
                .as("A deleted tag is no longer listed").doesNotContain(tag.getId());
        assertThat(TagApi.tagKeySuggestions(KEY, 10)).extracting(TagDefinition::getKey)
                .as("A deleted tag is no longer suggested").doesNotContain(KEY);
        tag = null;
    }

    @AfterAll
    public static void cleanup() {
        if (tag != null) {
            try {
                TagApi.deleteTag(tag.getId());
            } catch (RuntimeException ignored) {
                // best effort
            }
        }
    }
}
