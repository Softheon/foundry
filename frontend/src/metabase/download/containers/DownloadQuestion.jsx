
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
        title={t`Foundry Report`}
        message={t`If your download does not begin, please click below to retry`}
        download={{
          id: cardId,
          token: token
        }}
      />
    </Flex>
  )
}

export default fitViewport(DownloadQuestion)
