package com.openframe.data.document.user.filter;

import com.openframe.data.document.user.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Despite the {@code Regex} field names — retained for API compatibility — both values are
 * matched as literal case-insensitive substrings. The repository quotes them before they
 * reach the Mongo regex engine, so metacharacters carry no special meaning.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserQueryFilter {
    private String emailRegex;
    private String nameRegex;
    private UserStatus status;
}
