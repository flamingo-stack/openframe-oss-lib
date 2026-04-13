package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.service.TagService;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class TagDataFetcher {

    private static final Relay RELAY = new Relay();

    private final TagService tagService;

    @DgsData(parentType = "Tag", field = "id")
    public String tagNodeId(DgsDataFetchingEnvironment dfe) {
        Tag tag = dfe.getSource();
        return RELAY.toGlobalId("Tag", tag.getId());
    }

    @DgsQuery
    public List<Tag> tags() {
        log.debug("Fetching device tags (tenant-wide)");
        return tagService.listTags();
    }

    @DgsQuery
    public List<DeviceFilterOption> tagValueOptions(@InputArgument @NotBlank String tagKey) {
        log.debug("Fetching tag value options for key: {}", tagKey);
        return tagService.getTagValueOptions(tagKey);
    }

    @DgsQuery
    public List<Tag> tagKeySuggestions(
            @InputArgument String search,
            @InputArgument Integer limit) {
        log.debug("Autocomplete device tag keys (tenant-wide): search: {}, limit: {}", search, limit);
        return tagService.searchTagKeys(search, limit);
    }

    @DgsQuery
    public List<String> tagValueSuggestions(
            @InputArgument @NotBlank String tagKey,
            @InputArgument String search,
            @InputArgument Integer limit) {
        log.debug("Autocomplete device tag values (tenant-wide): key: {}, search: {}, limit: {}", tagKey, search, limit);
        return tagService.searchTagValues(tagKey, search, limit);
    }

    @DgsMutation
    public Tag createTag(
            @InputArgument @NotBlank String key,
            @InputArgument @NotBlank String entityType,
            @InputArgument String description,
            @InputArgument String color) {
        log.info("Creating tag '{}' with entityType: {}", key, entityType);
        TagEntityType type = TagEntityType.valueOf(entityType);
        return tagService.createTag(key, type, description, color);
    }

    @DgsMutation
    public Tag updateTag(
            @InputArgument @NotBlank String id,
            @InputArgument String key,
            @InputArgument String description,
            @InputArgument String color) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.info("Updating tag with global ID: {}, rawId: {}", id, rawId);
        return tagService.updateTag(rawId, key, description, color);
    }

    @DgsMutation
    public boolean deleteTag(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.info("Deleting tag with global ID: {}, rawId: {}", id, rawId);
        tagService.deleteTag(rawId);
        return true;
    }
}
