
import React from "react";
import { Flex } from "grid-styled";
import { t } from "c-3po";
import fitViewport from "metabase/hoc/FitViewPort";
import EmptyState from "metabase/components/EmptyState";

const DownloadQuestion = (props) => {
  const { fitClassNames } = props;
  const { cardId, token } = props.params;
  return (
    <Flex
      align="center"
      flexDirection="column"
      justify="center"
      className={fitClassNames}
    >
      <EmptyState
        illustrationElement={<img src="../app/assets/img/segments-list.png" />}
        title={t`Download Foundry Report`}
        message={t`Report is ready to download`}
        download={{
          id: cardId,
          token: token
        }}
      />
    </Flex>
  )
}

export default fitViewport(DownloadQuestion)
