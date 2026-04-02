package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.service.TagService;
import com.openframe.data.document.tool.Tag;
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
    public List<Tag> tags(@InputArgument @NotBlank String organizationId) {
        log.debug("Fetching tags for org: {}", organizationId);
        return tagService.listTags(organizationId);
    }

    @DgsQuery
    public List<DeviceFilterOption> tagValueOptions(@InputArgument @NotBlank String tagKey) {
        log.debug("Fetching tag value options for key: {}", tagKey);
        return tagService.getTagValueOptions(tagKey);
    }

    @DgsQuery
    public List<Tag> tagKeySuggestions(
            @InputArgument @NotBlank String organizationId,
            @InputArgument String search,
            @InputArgument Integer limit) {
        log.debug("Autocomplete tag keys for org: {}, search: {}, limit: {}", organizationId, search, limit);
        return tagService.searchTagKeys(organizationId, search, limit);
    }

    @DgsQuery
    public List<String> tagValueSuggestions(
            @InputArgument @NotBlank String organizationId,
            @InputArgument @NotBlank String tagKey,
            @InputArgument String search,
            @InputArgument Integer limit) {
        log.debug("Autocomplete tag values for org: {}, key: {}, search: {}, limit: {}", organizationId, tagKey, search, limit);
        return tagService.searchTagValues(organizationId, tagKey, search, limit);
    }
}
