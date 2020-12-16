import React, { Component } from "react";
import { t } from "c-3po";
import Tooltip from "metabase/components/Tooltip";
import NightModeIcon from "metabase/components/icons/NightModeIcon";
import FullscreenIcon from "metabase/components/icons/FullscreenIcon";
import RefreshWidget from "metabase/dashboard/components/RefreshWidget";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import Icon from "metabase/components/Icon.jsx";
import ModalWithTrigger from "metabase/components/ModalWithTrigger";
import ModalContent from "metabase/components/ModalContent.jsx";

export const getDashboardActions = ({
  isEditing = false,
  isEmpty = false,
  isFullscreen,
  isNightMode,
  onNightModeChange,
  onFullscreenChange,
  refreshPeriod,
  refreshElapsed,
  onRefreshPeriodChange,
  dashboard,
}) => {
  const buttons = [];

  if (!isEditing && !isEmpty) {
    buttons.push(
      <RefreshWidget
        key="refresh"
        data-metabase-event="Dashboard;Refresh Menu Open"
        className="text-brand-hover"
        period={refreshPeriod}
        elapsed={refreshElapsed}
        onChangePeriod={onRefreshPeriodChange}
      />,
    );
  }

  if (!isEditing && isFullscreen) {
    buttons.push(
      <Tooltip
        key="night"
        tooltip={isNightMode ? t`Daytime mode` : t`Nighttime mode`}
      >
        <span data-metabase-event={"Dashboard;Night Mode;" + !isNightMode}>
          <NightModeIcon
            className="text-brand-hover cursor-pointer"
            isNightMode={isNightMode}
            onClick={() => onNightModeChange(!isNightMode)}
          />
        </span>
      </Tooltip>,
    );
  }

  if (!isEditing && !isEmpty) {
    // option click to enter fullscreen without making the browser go fullscreen
    buttons.push(
      <Tooltip
        key="fullscreen"
        tooltip={isFullscreen ? t`Exit fullscreen` : t`Enter fullscreen`}
      >
        <span
          data-metabase-event={"Dashboard;Fullscreen Mode;" + !isFullscreen}
        >
          <FullscreenIcon
            className="text-brand-hover cursor-pointer"
            isFullscreen={isFullscreen}
            onClick={e => onFullscreenChange(!isFullscreen, !e.altKey)}
          />
        </span>
      </Tooltip>,
    );
    buttons.push(
      <SavedAsPdf dashboard={dashboard} />
    )
  }

  return buttons;
};


class SavedAsPdf extends Component {

  saveAsPdf = () => {
    const { dashboard } = this.props;
    const filename = (dashboard && dashboard.name || "dashboard") + '.pdf';
    let viz = document.querySelector('#dashboard_pdf');
    const clientRect = viz.getBoundingClientRect();
    const { height, width } = clientRect;
    const canvasOptions = {
      windowWidth: width,
      windowHeight: height,
      useCORS: true,
      allowTaint: true,
    }
    html2canvas(viz, canvasOptions).then(canvas => {
      let pdf = new jsPDF({
        orientation: 'l',
        //unit: 'px',
        //  format: [height, width],
        format: "a4"
      });
      const img = canvas.toDataURL('image/png');
      const pageHeight = pdf.internal.pageSize.height || pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.width || pdf.internal.pageSize.getWidth();
      const widthRatio = pageWidth / canvas.width;
      const heightRatio = pageHeight / canvas.height;
      const ratio = widthRatio > heightRatio ? heightRatio : widthRatio;

      const canvasWidth = canvas.width * ratio;
      const canvasHeight = canvas.height * ratio;

      const marginX = (pageWidth - canvasWidth) / 2;
      const marginY = (pageHeight - canvasHeight) / 2;

      // pdf.internal.pageSize.height +=100;
      pdf.addImage(img, 'JPEG', marginX, marginY, canvasWidth, canvasHeight);
      pdf.setFontSize(20);
      //  pdf.text( (dashboard.name || "") , pageWidth / 2, pageHeight +50, 'center');
      pdf.save(filename);
      this.refs.saveAsPdf.toggle();
    });
  }
  render() {
    return (
      <ModalWithTrigger
        ref="saveAsPdf"
        triggerElement={
          <Tooltip
            key="fullscreen"
            tooltip={"Save as Pdf"}
          >
            <Icon name="downarrow"
              onClick={ e => setTimeout(() => this.saveAsPdf(), 1000)}
            />
          </Tooltip>
        }
        onClo
      >
        <ModalContent
          title={"Download Dashboard"}
          formModal

        >
          <p className="mb4">{"Your download will begin shortly"}</p>
        </ModalContent>

      </ModalWithTrigger>

    )
  }
}