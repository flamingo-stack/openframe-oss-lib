package com.openframe.data.repository.device;

import lombok.Value;

import java.util.List;

@Value
public class MachineNameMatches {

    private final List<String> hostnames;
    private final List<String> nicknames;
}
