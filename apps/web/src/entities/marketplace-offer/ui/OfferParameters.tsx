import type { Offer } from "../model/types";
import {formatOfferNumber} from "../lib/format";
import "./offer.css";


export function OfferParameters({ offer: o }: { offer: Offer }) {


    return (
        <div className="offer-parameters">
            <div className="offer-parameters__main">
                <div>
                    {/*<div className="offer-parameters__label">Сумма займа</div>*/}
                    <div className="offer-parameters__amount">
                        {formatOfferNumber(o.loanAmount, " ₽")}
                    </div>
                </div>



            </div>

            <dl className="offer-parameters__details">
                <div>
                    <dt>Залог по объявлению</dt>
                    <dd>{formatOfferNumber(o.collateralValue, " ₽")}</dd>
                </div>

                <div>
                    <dt>Срок</dt>
                    <dd>{formatOfferNumber(o.loanTermMonths, " мес.")}</dd>
                </div>


                <div>
                    <dt>Ставка в месяц</dt>
                    <dd>{formatOfferNumber(o.interestRateMonthly, " %")}</dd>
                </div>
            </dl>
        </div>
    );
}