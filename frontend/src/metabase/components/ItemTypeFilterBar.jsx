import React from "react";
import { Flex } from "grid-styled";
import { t } from "c-3po";
import { withRouter } from "react-router";
import { connect } from "react-redux"
import Icon from "metabase/components/Icon";
import Link from "metabase/components/Link";
import { getUserIsAdmin, getUserIsPulseUser } from "metabase/selectors/user"
import colors from "metabase/lib/colors";

export const FILTERS = [
  {
    name: t`Everything`,
    filter: null,
    icon: "list",
  },
  {
    name: t`Dashboards`,
    filter: "dashboard",
    icon: "dashboard",
  },
  {
    name: t`Reports`,
    filter: "card",
    icon: "beaker",
  },
  {
    name: t`Pulses`,
    filter: "pulse",
    icon: "pulse",
  },
];
class ItemTypeFilterBar extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {

    const { location, analyticsContext, isAdmin, isPulseUser } = this.props;
    const filterSections = isPulseUser
      ? this.props.filters :
      this.props.filters.filter(
        section => section.filter !== 'pulse' || isAdmin);
    return (
      <Flex align="center" className="border-bottom mt1">
        {filterSections.map(f => {
          let isActive = location && location.query.type === f.filter;

          if (!location.query.type && !f.filter) {
            isActive = true;
          }

          const color = isActive ? colors.brand : "inherit";

          return (
            <Link
              to={{
                pathname: location.pathname,
                query: { ...location.query, type: f.filter },
              }}
              color={color}
              hover={{ color: colors.brand }}
              className="flex-full flex align-center justify-center sm-block text-brand-hover text-medium"
              mr={[0, 2]}
              key={f.filter}
              py={1}
              data-metabase-event={`${analyticsContext};Item Filter;${f.name}`}
              style={{
                borderBottom: `2px solid ${isActive ? colors.brand : "transparent"
                  }`,
              }}
            >
              <Icon name={f.icon} className="sm-hide" size={20} />
              <h5
                className="text-uppercase hide sm-show"
                style={{
                  color: isActive ? colors.brand : "inherit",
                  fontWeight: 900,
                }}
              >
                {f.name}
              </h5>
            </Link>
          );
        })}
      </Flex>
    );
  }
}

ItemTypeFilterBar.defaultProps = {
  filters: FILTERS,
};

const mapStateToProps = (state, props) => {
  return {
    isAdmin: getUserIsAdmin(state),
    isPulseUser: getUserIsPulseUser(state)
  }
}
export default withRouter(connect(mapStateToProps, null)(ItemTypeFilterBar));
