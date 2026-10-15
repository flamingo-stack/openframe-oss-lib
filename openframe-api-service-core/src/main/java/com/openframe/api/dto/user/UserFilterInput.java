package com.openframe.api.dto.user;

import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserFilterInput {
    private List<UserStatus> statuses;
    /** Effective roles: ADMIN matches the owners too. */
    private List<UserRole> roles;
    /** Users left out; the data fetcher hands the service raw ids. */
    private List<String> excludeIds;
}
