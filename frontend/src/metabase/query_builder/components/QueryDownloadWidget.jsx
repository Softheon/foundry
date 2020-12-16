import React from "react";
import PropTypes from "prop-types";
import { Box } from "grid-styled";

import { t } from "c-3po";
import { parse as urlParse } from "url";
import querystring from "querystring";

import PopoverWithTrigger from "metabase/components/PopoverWithTrigger.jsx";
import Icon from "metabase/components/Icon.jsx";
import DownloadButton, {
  DownloadModalButton,
} from "metabase/components/DownloadButton.jsx";
import Tooltip from "metabase/components/Tooltip.jsx";

import * as Urls from "metabase/lib/urls";

import _ from "underscore";
import cx from "classnames";
import { settingValues } from "../../admin/settings/selectors";
import { connect } from "react-redux";
const EXPORT_FORMATS = ["csv", "xlsx"];

const mapStateToProps = (state, props) => {
  return {
    settingValues: settingValues(state),
  };
};
@connect(mapStateToProps, null)
class QueryDownloadWidget extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    const {
      className,
      classNameClose,
      card,
      result,
      uuid,
      token,
      dashcardId,
      icon,
      params,
      settingValues,
    } = this.props;
    const exportFormats = ["csv"];
    if (settingValues["enable_xlsx_download"]) {
      exportFormats.push("xlsx");
    }
    const rowLimit = settingValues["absolute-max-results"];
    const unsavedRowLimit =
      settingValues["unsaved-question-max-results"] || 2000;
    const isSaved = card["id"] ? true : false;
    // remove xlsx download option
    if (!isSaved && settingValues["enable_xlsx_download"]) {
      exportFormats.splice(-1, 1);
    }
    exportFormats.push("pdf");
    const downloadSizeMessage = rowLimit ? (
      <p>{t`The maximum download size is ${rowLimit} rows.`}</p>
    ) : (
        <p>{t`The maximum download size is limited.`}</p>
      );
    return (
      <PopoverWithTrigger
        triggerElement={
          <Tooltip tooltip={t`Download full results`}>
            <Icon title={t`Download this data`} name={icon} size={16} />
          </Tooltip>
        }
        triggerClasses={cx(className, "text-brand-hover")}
        triggerClassesClose={classNameClose}
      >
        <Box
          p={2}
          w={result.data && result.data.rows_truncated != null ? 300 : 260}
        >
          <Box p={1}>
            <h4>{t`Download full results`}</h4>
          </Box>
          {result.data != null && result.data.rows_truncated != null && (
            <Box>
              <p>{t`Your answer has a large number of rows so it could take a while to download.`}</p>
              {/* {!isSaved ? (
                <p className="text-error">{t`The question is not saved, so the maximum download size will be limited to first
                ${unsavedRowLimit} rows.`}</p>
              ) : (
                downloadSizeMessage
              )} */}
              <p>{t`The maximum download size is 1 million rows.`}</p>
            </Box>
          )}
          <Box>
            {exportFormats.map((type) => (
              <Box w={"100%"} key={type}>
                {dashcardId && token ? (
                  <DashboardEmbedQueryButton
                    key={type}
                    type={type}
                    dashcardId={dashcardId}
                    token={token}
                    card={card}
                    params={params}
                  />
                ) : uuid ? (
                  <PublicQueryButton
                    key={type}
                    type={type}
                    uuid={uuid}
                    result={result}
                  />
                ) : token ? (
                  <EmbedQueryButton key={type} type={type} token={token} />
                ) : card && card.id ? (
                  <SavedQueryButton
                    key={type}
                    type={type}
                    card={card}
                    result={result}
                  />
                ) : card && !card.id ? (
                  <UnsavedQueryButton
                    key={type}
                    type={type}
                    card={card}
                    result={result}
                  />
                ) : null}
              </Box>
            ))}
          </Box>
        </Box>
      </PopoverWithTrigger>
    );
  }
}
const QueryDownloadWidget_old = ({
  className,
  classNameClose,
  card,
  result,
  uuid,
  token,
  dashcardId,
  icon,
  params,
}) => (
    <PopoverWithTrigger
      triggerElement={
        <Tooltip tooltip={t`Download full results`}>
          <Icon title={t`Download this data`} name={icon} size={16} />
        </Tooltip>
      }
      triggerClasses={cx(className, "text-brand-hover")}
      triggerClassesClose={classNameClose}
    >
      <Box
        p={2}
        w={result.data && result.data.rows_truncated != null ? 300 : 260}
      >
        <Box p={1}>
          <h4>{t`Download full results`}</h4>
        </Box>
        {result.data != null && result.data.rows_truncated != null && (
          <Box>
            <p>{t`Your answer has a large number of rows so it could take a while to download.`}</p>
            <p>{t`The maximum download size is 1 million rows.`}</p>
          </Box>
        )}
        <Box>
          {EXPORT_FORMATS.map((type) => (
            <Box w={"100%"}>
              {dashcardId && token ? (
                <DashboardEmbedQueryButton
                  key={type}
                  type={type}
                  dashcardId={dashcardId}
                  token={token}
                  card={card}
                  params={params}
                />
              ) : uuid ? (
                <PublicQueryButton
                  key={type}
                  type={type}
                  uuid={uuid}
                  result={result}
                />
              ) : token ? (
                <EmbedQueryButton key={type} type={type} token={token} />
              ) : card && card.id ? (
                <SavedQueryButton
                  key={type}
                  type={type}
                  card={card}
                  result={result}
                />
              ) : card && !card.id ? (
                <UnsavedQueryButton
                  key={type}
                  type={type}
                  card={card}
                  result={result}
                />
              ) : null}
            </Box>
          ))}
        </Box>
      </Box>
    </PopoverWithTrigger>
  );

const UnsavedQueryButton = ({ type, result: { json_query }, card }) => (
  <DownloadModalButton
    url={`api/dataset/${type}`}
    params={{ query: JSON.stringify(_.omit(json_query, "constraints")) }}
    extensions={[type]}
    card={card}
  >
    {type}
  </DownloadModalButton>
);

const SavedQueryButton = ({ type, result: { json_query }, card }) => (
  <DownloadModalButton
    url={`api/card/${card.id}/query/${type}`}
    params={{ parameters: JSON.stringify(json_query.parameters) }}
    extensions={[type]}
    card={card}
  >
    {type}
  </DownloadModalButton>
);

const PublicQueryButton = ({ type, uuid, result: { json_query } }) => (
  <DownloadButton
    method="GET"
    url={Urls.publicQuestion(uuid, type)}
    params={{ parameters: JSON.stringify(json_query.parameters) }}
    extensions={[type]}
  >
    {type}
  </DownloadButton>
);

const EmbedQueryButton = ({ type, token }) => {
  // Parse the query string part of the URL (e.g. the `?key=value` part) into an object. We need to pass them this
  // way to the `DownloadButton` because it's a form which means we need to insert a hidden `<input>` for each param
  // we want to pass along. For whatever wacky reason the /api/embed endpoint expect params like ?key=value instead
  // of like ?params=<json-encoded-params-array> like the other endpoints do.
  const query = urlParse(window.location.href).query; // get the part of the URL that looks like key=value
  const params = query && querystring.parse(query); // expand them out into a map

  return (
    <DownloadButton
      method="GET"
      url={Urls.embedCard(token, type)}
      params={params}
      extensions={[type]}
    >
      {type}
    </DownloadButton>
  );
};

const DashboardEmbedQueryButton = ({
  type,
  dashcardId,
  token,
  card,
  params,
}) => (
    <DownloadButton
      method="GET"
      url={`api/embed/dashboard/${token}/dashcard/${dashcardId}/card/${card.id}/${type}`}
      extensions={[type]}
      params={params}
    >
      {type}
    </DownloadButton>
  );

QueryDownloadWidget.propTypes = {
  card: PropTypes.object,
  result: PropTypes.object,
  uuid: PropTypes.string,
  icon: PropTypes.string,
  params: PropTypes.object,
};

QueryDownloadWidget.defaultProps = {
  result: {},
  icon: "downarrow",
  params: {},
};

export default QueryDownloadWidget;
