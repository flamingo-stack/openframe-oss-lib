package com.openframe.api.dto.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// DGS binds input types through a no-args constructor and setters.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsVersionFilterInput {

    private List<String> organizationIds;
}
