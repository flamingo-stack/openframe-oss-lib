package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.tag.CreateTagInput;
import com.openframe.api.dto.tag.UpdateTagInput;
import com.openframe.api.service.TagService;
import com.openframe.data.document.tool.Tag;
import com.openframe.data.document.tool.TagType;
import jakarta.validation.Valid;
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

    private final TagService tagService;

    @DgsQuery
    public List<Tag> tags(@InputArgument @NotBlank String organizationId,
                          @InputArgument List<TagType> types) {
        log.debug("Fetching tags for org: {}, types: {}", organizationId, types);
        return tagService.listTags(organizationId, types);
    }

    @DgsQuery
    public Tag tag(@InputArgument @NotBlank String tagId) {
        log.debug("Fetching tag by ID: {}", tagId);
        return tagService.findTagById(tagId).orElse(null);
    }

    @DgsQuery
    public List<DeviceFilterOption> tagValueOptions(@InputArgument @NotBlank String tagKey) {
        log.debug("Fetching tag value options for key: {}", tagKey);
        return tagService.getTagValueOptions(tagKey);
    }

    @DgsMutation
    public Tag createTag(@InputArgument @Valid CreateTagInput input) {
        log.info("Creating tag via GraphQL - key: {}, type: {}, org: {}",
                input.getKey(), input.getType(), input.getOrganizationId());

        return tagService.createTag(
                input.getKey(),
                input.getType(),
                input.getDescription(),
                input.getColor(),
                input.getOrganizationId(),
                null, // createdBy — not available in GraphQL context without auth
                input.getValues()
        );
    }

    @DgsMutation
    public Tag updateTag(@InputArgument @NotBlank String tagId,
                         @InputArgument @Valid UpdateTagInput input) {
        log.info("Updating tag via GraphQL - tagId: {}", tagId);

        // TODO: extract organizationId from auth context (SecurityContextHolder) once auth is wired in
        return tagService.updateTag(
                tagId,
                input.getDescription(),
                input.getColor(),
                input.getType(),
                input.getValues(),
                null
        );
    }

    @DgsMutation
    public boolean deleteTag(@InputArgument @NotBlank String tagId) {
        log.info("Deleting tag via GraphQL - tagId: {}", tagId);
        // TODO: extract organizationId from auth context (SecurityContextHolder) once auth is wired in
        tagService.deleteTag(tagId, null);
        return true;
    }
}
