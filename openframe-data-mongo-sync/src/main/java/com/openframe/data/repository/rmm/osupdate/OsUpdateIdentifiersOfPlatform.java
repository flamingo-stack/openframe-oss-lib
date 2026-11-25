package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateIdentifiersOfPlatform {

    // The key the aggregation groups by.
    @Id
    private OsPlatform platform;
    private List<String> identifiers;
}
