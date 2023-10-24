<?php

namespace App\Enum;

enum MergeResolutionEnum: int
{
    case NONE = 0;
    case DEFAULT = 1;
    case NO_RESTRICTIONS = 2; // no conflicts will occur
    case OLDER_CHANGES = 3; // we do not allow changes from FE that are based on older data (older `lastModified`) from DB - will cause conflict
    case USER_INTERACTION_NEEDED = 4; // default setting that will force conflict on any change


    public static function toInt(MergeResolutionEnum $value): int {
        switch ($value) {
            case self::NONE: return 0;
            case self::DEFAULT: return 1;
            case self::NO_RESTRICTIONS: return 2;
            case self::OLDER_CHANGES: return 3;
            case self::USER_INTERACTION_NEEDED: return 4;
            default: return 2;
        }
    }

    public static function fromInt(int $value): MergeResolutionEnum {
        switch ($value) {
            case 0: return self::NONE;
            case 1: return self::DEFAULT;
            case 2: return self::NO_RESTRICTIONS;
            case 3: return self::OLDER_CHANGES;
            case 4: return self::USER_INTERACTION_NEEDED;
            default: return self::NO_RESTRICTIONS;
        }
    }
}
