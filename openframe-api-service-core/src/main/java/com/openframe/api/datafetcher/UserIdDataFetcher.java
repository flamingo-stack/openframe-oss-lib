package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.user.UserResponse;

@DgsComponent
public class UserIdDataFetcher {

    // User.id stays raw until its consumers move to Relay global ids; this keeps the Node id wiring off it.
    @DgsData(parentType = "User", field = "id")
    public String userRawId(DgsDataFetchingEnvironment dfe) {
        UserResponse user = dfe.getSource();
        return user.getId();
    }
}
