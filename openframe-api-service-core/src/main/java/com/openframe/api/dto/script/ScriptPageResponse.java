package com.openframe.api.dto.script;

import com.openframe.core.pagination.PageResponse;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;

/**
 * Paginated wrapper for {@link ScriptResponse} items, following the same
 * convention as {@code UserPageResponse}.
 */
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class ScriptPageResponse extends PageResponse<ScriptResponse> {
}
