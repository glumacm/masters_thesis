<?php

namespace App\Enum;

enum MergeResolutionEnum: int
{
    case NONE = 0; // POTREBNO DODATI NEK ZAPIS V KONFIGURACIJO KJER BO POVEDALO, KAJ NAREDITI V PRIMERU `NONE` (MOGOCE JE TA OPCIJA IDENTICNA KOT OPCIJA `DEFAULT`).
    case DEFAULT = 1; // @TODO ?? A ima to sploh smisel?
    case NO_RESTRICTIONS = 2; // POMENI, DA CE IMAMO V SPREMEMBAH TA FIELD, NAS NE ZANIMA KDAJ JE BIL POSODOBLJEN. CE PISE DA JE SPREMENJEN GA SPREMENI
    case NEWER_CHANGES = 3; // POMENI, DA CE JE FIELD V SPREMEMBAH, MORAS PREVERITI ALI IMA `RECORD` IZ `BE` VECJI `UPDATED_AT` KOT SPREMEMBA
    case OLDER_CHANGES = 4; // POMENI, DA CE JE FIELD V SPREMEMBAH, MORAS PREVERITI ALI IMA `RECORD` IZ `BE` MANJSI `UPDATED_AT` KOT SPREMEMBA
    case USER_INTERACTION_NEEDED = 5;


    public static function toInt(MergeResolutionEnum $value): int {
        switch ($value) {
            case self::NONE: return 0;
            case self::DEFAULT: return 1;
            case self::NO_RESTRICTIONS: return 2;
            case self::NEWER_CHANGES: return 3;
            case self::OLDER_CHANGES: return 4;
            case self::USER_INTERACTION_NEEDED: return 5;
            default: return 2; # v primeru da ni pravilen podatek, bomo vrnili NO_RESTRICTIONS
        }
    }

    public static function fromInt(int $value): MergeResolutionEnum {
        switch ($value) {
            case 0: return self::NONE;
            case 1: return self::DEFAULT;
            case 2: return self::NO_RESTRICTIONS;
            case 3: return self::NEWER_CHANGES;
            case 4: return self::OLDER_CHANGES;
            case 5: return self::USER_INTERACTION_NEEDED;
            default: return self::NO_RESTRICTIONS;
        }
    }
}
