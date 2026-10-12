package com.openframe.api.dto.user;

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
}
