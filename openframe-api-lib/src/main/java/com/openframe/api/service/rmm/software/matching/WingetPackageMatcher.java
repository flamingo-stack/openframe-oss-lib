package com.openframe.api.service.rmm.software.matching;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toSet;
import static org.springframework.util.StringUtils.hasText;

// winget's own correlation of an installed program (CompositeSource + the 2.0 index search), minus what only the
// device knows (packages winget itself installed there):
// - one search for the program's ProductCode, UpgradeCode and normalized name + publisher together;
// - the name is first searched with the architecture it carries, and only when that finds nothing, without it;
// - one package found is the match; of several, the single one found by a code is; otherwise there is none.
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class WingetPackageMatcher implements PackageMatcher {

    private final PackageCatalogRepository catalogRepository;

    @Override
    public PackageManagerType getManager() {
        return PackageManagerType.WINGET;
    }

    @Override
    public List<PackageMatch> match(List<SoftwareResponse> rows) {
        List<ProgramKeys> programs = rows.stream().map(ProgramKeys::of).toList();
        CatalogLookup catalog = lookUp(programs);
        return programs.stream().map(catalog::matchOf).toList();
    }

    private CatalogLookup lookUp(List<ProgramKeys> programs) {
        Set<String> productCodes = keys(programs, ProgramKeys::getProductCodes);
        Set<String> upgradeCodes = keys(programs, ProgramKeys::getUpgradeCodes);
        Set<String> names = keys(programs, ProgramKeys::getNames);
        List<PackageCatalogEntry> byProductCode = productCodes.isEmpty() ? List.of()
                : catalogRepository.findByManagerAndProductCodesIn(getManager(), productCodes);
        List<PackageCatalogEntry> byUpgradeCode = upgradeCodes.isEmpty() ? List.of()
                : catalogRepository.findByManagerAndUpgradeCodesIn(getManager(), upgradeCodes);
        List<PackageCatalogEntry> byName = names.isEmpty() ? List.of()
                : catalogRepository.findByManagerAndNormalizedNamesIn(getManager(), names);
        return new CatalogLookup(byProductCode, byUpgradeCode, byName);
    }

    private static Set<String> keys(List<ProgramKeys> programs, Function<ProgramKeys, List<String>> keysOf) {
        return programs.stream().flatMap(program -> keysOf.apply(program).stream()).collect(toSet());
    }

    private static final class CatalogLookup {

        private final List<PackageCatalogEntry> byProductCode;
        private final List<PackageCatalogEntry> byUpgradeCode;
        private final List<PackageCatalogEntry> byName;

        private CatalogLookup(List<PackageCatalogEntry> byProductCode, List<PackageCatalogEntry> byUpgradeCode,
                              List<PackageCatalogEntry> byName) {
            this.byProductCode = byProductCode;
            this.byUpgradeCode = byUpgradeCode;
            this.byName = byName;
        }

        PackageMatch matchOf(ProgramKeys program) {
            if (program.hasArchitecture()) {
                Map<String, Candidate> withArchitecture = candidates(program, program.getNameWithArchitecture());
                if (!withArchitecture.isEmpty()) {
                    return pick(withArchitecture);
                }
            }
            Map<String, Candidate> withoutArchitecture = candidates(program, program.getPlainName());
            return pick(withoutArchitecture);
        }

        private Map<String, Candidate> candidates(ProgramKeys program, String name) {
            Map<String, Candidate> candidates = new LinkedHashMap<>();
            byProductCode.stream()
                    .filter(entry -> containsAny(entry.getProductCodes(), program.getProductCodes()))
                    .forEach(entry -> add(candidates, entry, true));
            byUpgradeCode.stream()
                    .filter(entry -> containsAny(entry.getUpgradeCodes(), program.getUpgradeCodes()))
                    .forEach(entry -> add(candidates, entry, true));
            byName.stream()
                    .filter(entry -> program.hasPublisher() && hasNameAndPublisher(entry, name, program.getPublisher()))
                    .forEach(entry -> add(candidates, entry, false));
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

        private static void add(Map<String, Candidate> candidates, PackageCatalogEntry entry, boolean byCode) {
            Candidate found = new Candidate(entry, byCode);
            candidates.merge(entry.getPackageId(), found, Candidate::strongerOf);
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

    // a package the search found; strong when found by a code rather than by name and publisher
    @Getter
    @AllArgsConstructor
    private static final class Candidate {
        private final PackageCatalogEntry entry;
        private final boolean strong;

        Candidate strongerOf(Candidate other) {
            return strong ? this : other;
        }
    }

    // a program's keys as winget folds and normalizes them
    private static final class ProgramKeys {

        private final List<String> productCodes;
        private final List<String> upgradeCodes;
        private final List<String> names;
        private final String publisher;

        private ProgramKeys(List<String> productCodes, List<String> upgradeCodes, List<String> names, String publisher) {
            this.productCodes = productCodes;
            this.upgradeCodes = upgradeCodes;
            this.names = names;
            this.publisher = publisher;
        }

        static ProgramKeys of(SoftwareResponse row) {
            List<String> productCodes = foldedIfPresent(row.getProductCode());
            List<String> upgradeCodes = foldedIfPresent(row.getUpgradeCode());
            List<String> names = row.getName() == null ? List.of() : WingetNameNormalizer.searchNames(row.getName());
            String publisher = hasText(row.getPublisher()) ? WingetNameNormalizer.searchPublisher(row.getPublisher()) : "";
            return new ProgramKeys(productCodes, upgradeCodes, names, publisher);
        }

        private static List<String> foldedIfPresent(String value) {
            return Stream.ofNullable(value)
                    .filter(code -> hasText(code))
                    .map(code -> code.toLowerCase(Locale.ROOT))
                    .toList();
        }

        List<String> getProductCodes() {
            return productCodes;
        }

        List<String> getUpgradeCodes() {
            return upgradeCodes;
        }

        List<String> getNames() {
            return hasPublisher() ? names : List.of();
        }

        String getPublisher() {
            return publisher;
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
