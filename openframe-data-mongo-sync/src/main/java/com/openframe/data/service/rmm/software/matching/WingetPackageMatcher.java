package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import static java.util.stream.Collectors.toSet;
import static org.springframework.util.StringUtils.hasText;

// winget's own correlation of an installed program (CompositeSource + the 2.0 index search), minus what only the
// device knows (packages winget itself installed there):
// - a SystemComponent entry is not a program winget lists, so it has no package;
// - one search for the program's PackageFamilyName, ProductCode, UpgradeCode and normalized name + publisher together;
// - the name is first searched with the architecture it carries, and only when that finds nothing, without it;
// - one package found is the match; of several, the single one found by a code or PFN is; otherwise there is none.
@Component
@RequiredArgsConstructor
public class WingetPackageMatcher implements PackageMatcher {

    private final PackageCatalogRepository catalogRepository;

    @Override
    public PackageManagerType getManager() {
        return PackageManagerType.WINGET;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        List<ProgramKeys> keys = programs.stream().map(ProgramKeys::of).toList();
        CatalogLookup catalog = lookUp(keys);
        return keys.stream().map(catalog::matchOf).toList();
    }

    private CatalogLookup lookUp(List<ProgramKeys> programs) {
        Set<String> productCodes = keys(programs, ProgramKeys::getProductCodes);
        Set<String> upgradeCodes = keys(programs, ProgramKeys::getUpgradeCodes);
        Set<String> packageFamilyNames = keys(programs, ProgramKeys::getPackageFamilyNames);
        Set<String> names = keys(programs, ProgramKeys::getNames);
        if (productCodes.isEmpty() && upgradeCodes.isEmpty() && packageFamilyNames.isEmpty() && names.isEmpty()) {
            return new CatalogLookup(List.of());
        }
        return new CatalogLookup(catalogRepository.findByManagerAndAnyMatchingKey(getManager(), productCodes,
                upgradeCodes, packageFamilyNames, names));
    }

    private static Set<String> keys(List<ProgramKeys> programs, Function<ProgramKeys, List<String>> keysOf) {
        return programs.stream()
                .filter(program -> !program.isSystemComponent())
                .flatMap(program -> keysOf.apply(program).stream())
                .collect(toSet());
    }

    private static final class CatalogLookup {

        private final List<PackageCatalogEntry> entries;

        private CatalogLookup(List<PackageCatalogEntry> entries) {
            this.entries = entries;
        }

        PackageMatch matchOf(ProgramKeys program) {
            if (program.isSystemComponent()) {
                return PackageMatch.noPackage();
            }
            if (program.hasArchitecture()) {
                Map<String, Candidate> withArchitecture = candidates(program, program.getNameWithArchitecture());
                if (!withArchitecture.isEmpty()) {
                    return pick(withArchitecture);
                }
            }
            return pick(candidates(program, program.getPlainName()));
        }

        private Map<String, Candidate> candidates(ProgramKeys program, String name) {
            Map<String, Candidate> candidates = new LinkedHashMap<>();
            for (PackageCatalogEntry entry : entries) {
                if (containsAny(entry.getProductCodes(), program.getProductCodes())
                        || containsAny(entry.getUpgradeCodes(), program.getUpgradeCodes())
                        || containsAny(entry.getPackageFamilyNames(), program.getPackageFamilyNames())) {
                    candidates.put(entry.getPackageId(), new Candidate(entry, true));
                } else if (program.hasPublisher() && hasNameAndPublisher(entry, name, program.getPublisher())) {
                    candidates.putIfAbsent(entry.getPackageId(), new Candidate(entry, false));
                }
            }
            return candidates;
        }

        private static PackageMatch pick(Map<String, Candidate> candidates) {
            if (candidates.isEmpty()) {
                return PackageMatch.noPackage();
            }
            if (candidates.size() == 1) {
                Candidate only = candidates.values().iterator().next();
                return PackageMatch.of(only.getEntry());
            }
            List<Candidate> strong = candidates.values().stream().filter(Candidate::isStrong).toList();
            return strong.size() == 1 ? PackageMatch.of(strong.getFirst().getEntry()) : PackageMatch.ambiguous();
        }

        private static boolean hasNameAndPublisher(PackageCatalogEntry entry, String name, String publisher) {
            return contains(entry.getNormalizedNames(), name) && contains(entry.getNormalizedPublishers(), publisher);
        }

        private static boolean containsAny(List<String> values, List<String> wanted) {
            return values != null && wanted.stream().anyMatch(values::contains);
        }

        private static boolean contains(List<String> values, String wanted) {
            return values != null && values.contains(wanted);
        }
    }

    // a package the search found; strong when found by a code or PFN rather than by name and publisher
    @Getter
    @AllArgsConstructor
    private static final class Candidate {
        private final PackageCatalogEntry entry;
        private final boolean strong;
    }

    // a program's keys as winget folds and normalizes them
    @Getter
    private static final class ProgramKeys {

        private final List<String> productCodes;
        private final List<String> upgradeCodes;
        private final List<String> packageFamilyNames;
        private final List<String> names;
        private final String publisher;
        private final boolean systemComponent;

        private ProgramKeys(InstalledProgram program) {
            this.productCodes = folded(program.getProductCodes());
            this.upgradeCodes = folded(List.of(program.getUpgradeCode() == null ? "" : program.getUpgradeCode()));
            this.packageFamilyNames = folded(program.getPackageFamilyNames());
            this.names = program.getName() == null ? List.of() : WingetNameNormalizer.searchNames(program.getName());
            this.publisher = hasText(program.getPublisher())
                    ? WingetNameNormalizer.searchPublisher(program.getPublisher()) : "";
            this.systemComponent = program.isSystemComponent();
        }

        static ProgramKeys of(InstalledProgram program) {
            return new ProgramKeys(program);
        }

        private static List<String> folded(List<String> values) {
            return values == null ? List.of() : values.stream()
                    .filter(value -> hasText(value))
                    .map(value -> value.toLowerCase(Locale.ROOT))
                    .toList();
        }

        // winget searches a name only together with a publisher
        List<String> getNames() {
            return hasPublisher() ? names : List.of();
        }

        boolean hasPublisher() {
            return !publisher.isEmpty();
        }

        boolean hasArchitecture() {
            return names.size() > 1;
        }

        String getNameWithArchitecture() {
            return names.getFirst();
        }

        String getPlainName() {
            return names.isEmpty() ? "" : names.getLast();
        }
    }
}
