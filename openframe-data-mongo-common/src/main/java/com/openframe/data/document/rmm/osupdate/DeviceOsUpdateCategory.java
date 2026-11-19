package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceOsUpdateCategory {

    // Named explicitly: Spring Data stores a bare "id" property as "_id", and queries on stored rows use "categories.id".
    @Field("id")
    private String id;
    private String name;
}
